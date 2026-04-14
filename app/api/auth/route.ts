/**
 * POST /api/auth
 *
 * Telegram Mini App authentication endpoint.
 *
 * Flow:
 *  1. Receive raw Telegram initData from the client.
 *  2. Validate via HMAC-SHA256 against TELEGRAM_BOT_TOKEN.
 *  3. Upsert the user in auth.users (via Supabase admin API).
 *  4. Upsert public.users (name sync).
 *  5. Fetch shop access + subscription state.
 *  6. Sign a Supabase-compatible HS256 JWT with custom claims.
 *  7. Set it as an HTTP-only cookie.
 *  8. Return AuthResponse JSON to the client.
 *
 * Dev mode: accept { dev_role, dev_telegram_id } to bypass Telegram validation.
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateTelegramInitData, validateTelegramWidgetData } from '@/lib/telegram/validate'
import { createServiceClient } from '@/lib/supabase/server'
import { signSession, getSessionCookieOptions, SESSION_COOKIE } from '@/lib/auth/session'
import { getUserContext } from '@/lib/auth/getUser'
import { ok, err } from '@/lib/utils'
import type { AuthResponse, UserRole } from '@/lib/types'
import { inferShopRoleFromUserRole, normalizePlatformRole } from '@/lib/roles'

const IS_DEV = process.env.NODE_ENV === 'development'
const DEV_DEMO_SHOP_ID = '00000000-0000-0000-0000-000000000001'
const DASHBOARD_SESSION_TTL_SEC = 60 * 60 * 24 * 7

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))

    // ── Dev bypass ──────────────────────────────────────────────────────────
    if (IS_DEV && body.dev_role) {
      return handleDevAuth(body.dev_role, body.dev_telegram_id ?? 99999999)
    }

    // ── Telegram Login Widget (dashboard web) ──────────────────────────────
    if (body.tg_widget) {
      const botToken = process.env.TELEGRAM_BOT_TOKEN
      if (!botToken) {
        console.error('[auth] TELEGRAM_BOT_TOKEN not configured')
        return NextResponse.json(err('CONFIG_ERROR', 'Server misconfigured'), { status: 500 })
      }

      const { valid, data: widgetData } = validateTelegramWidgetData(body.tg_widget, botToken)
      if (!valid || !widgetData) {
        return NextResponse.json(err('INVALID_WIDGET_DATA', 'Telegram Widget authentication failed'), { status: 401 })
      }

      const fullName = [widgetData.first_name, widgetData.last_name].filter(Boolean).join(' ').trim()
      const email = `t_${widgetData.id}@birliy.app`

      return await upsertUserAndRespond(
        {
          telegramId: widgetData.id,
          fullName,
          username: widgetData.username,
          email,
        },
        { maxAge: DASHBOARD_SESSION_TTL_SEC },
      )
    }

    // ── Validate Telegram initData ──────────────────────────────────────────
    const rawInitData: string | undefined = body?.initData
    if (!rawInitData) {
      return NextResponse.json(err('MISSING_INIT_DATA', 'initData is required'), { status: 400 })
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN
    if (!botToken) {
      console.error('[auth] TELEGRAM_BOT_TOKEN not configured')
      return NextResponse.json(err('CONFIG_ERROR', 'Server misconfigured'), { status: 500 })
    }

    const { valid, data: initData } = validateTelegramInitData(rawInitData, botToken)
    if (!valid || !initData?.user) {
      return NextResponse.json(err('INVALID_INIT_DATA', 'Telegram authentication failed'), { status: 401 })
    }

    const tgUser   = initData.user
    const fullName = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ').trim()
    const email    = `t_${tgUser.id}@birliy.app`

    return await upsertUserAndRespond({ telegramId: tgUser.id, fullName, username: tgUser.username, email })
  } catch (e) {
    console.error('[auth] unexpected error:', e)
    return NextResponse.json(err('INTERNAL_ERROR', 'Internal server error'), { status: 500 })
  }
}

// ─── Core upsert + session issuance ──────────────────────────────────────────

async function upsertUserAndRespond(opts: {
  telegramId: number
  fullName:   string
  username?:  string
  email:      string
}, sessionOpts: { maxAge?: number } = {}) {
  const { telegramId, fullName, username, email } = opts
  const adminClient = createServiceClient()

  // 1. Look up existing public.users row by telegram_id
  const { data: existingUser } = await adminClient
    .from('users')
    .select('id, role')
    .eq('telegram_id', telegramId)
    .maybeSingle()

  let userId: string

  if (existingUser) {
    userId = existingUser.id
    const nextPlatformRole = existingUser.role === 'super_admin'
      ? 'super_admin'
      : normalizePlatformRole('waiter')
    // Keep name in sync silently
    await adminClient
      .from('users')
      .update({ name: fullName, username: username ?? null, role: nextPlatformRole })
      .eq('id', userId)
  } else {
    // 2. Create Supabase auth user (email_confirm bypasses email verification)
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { telegram_id: telegramId, name: fullName },
    })

    if (authError || !authData?.user) {
      // Handle duplicate email (user already exists in auth but not in public.users)
      if (authError?.message?.includes('already been registered')) {
        // This is expensive; in practice, look up by email via admin API
        const existingAuthUser = await findAuthUserByEmail(email)
        if (!existingAuthUser) {
          console.error('[auth] auth user conflict, cannot resolve:', authError)
          return NextResponse.json(err('AUTH_ERROR', 'Auth user conflict'), { status: 500 })
        }
        userId = existingAuthUser
      } else {
        console.error('[auth] createUser error:', authError)
        return NextResponse.json(err('AUTH_ERROR', 'Failed to create auth user'), { status: 500 })
      }
    } else {
      userId = authData.user.id
    }

    // 3. Insert public.users linked to the auth user
    const { error: insertError } = await adminClient.from('users').insert({
      id:          userId,
      telegram_id: telegramId,
      name:        fullName,
      username:    username ?? null,
      role:        normalizePlatformRole('waiter'),
    })

    if (insertError && insertError.code !== '23505') {
      // 23505 = unique violation (race condition — row already exists)
      console.error('[auth] users insert error:', insertError)
      return NextResponse.json(err('DB_ERROR', 'Failed to create user record'), { status: 500 })
    }

    // If 23505, re-fetch the existing row
    if (insertError?.code === '23505') {
      const { data } = await adminClient.from('users').select('id').eq('telegram_id', telegramId).single()
      if (data) userId = data.id
    }
  }

  // 4. Fetch full context (shop access + subscription)
  const context = await getUserContext(userId)

  // 5. Build and sign session JWT
  const shopIds       = context.shopAccess.map((e) => e.shop_id)
  const sessionToken  = await signSession({
    userId:         userId,
    appRole:        context.appRole,
    shopIds,
    primaryShopId:  context.primaryShopId,
    subscriptionOk: context.subscriptionOk,
    ttlSec:         sessionOpts.maxAge,
  })

  // 6. Set cookie + return response
  const payload: AuthResponse = {
    user:            context.user,
    role:            context.appRole,
    has_shop_access: context.hasShopAccess,
    subscription_ok: context.subscriptionOk,
    primary_shop_id: context.primaryShopId,
  }

  const response = NextResponse.json(ok<AuthResponse>(payload))
  response.cookies.set(SESSION_COOKIE, sessionToken, getSessionCookieOptions({ maxAge: sessionOpts.maxAge }))
  return response
}

// ─── Dev auth helper ──────────────────────────────────────────────────────────

async function handleDevAuth(devRole: string, telegramId: number) {
  if (!['waiter', 'kitchen', 'manager', 'owner', 'super_admin'].includes(devRole)) {
    return NextResponse.json(err('BAD_DEV_ROLE', 'Invalid dev_role'), { status: 400 })
  }

  const role  = devRole as UserRole
  const email = `t_${telegramId}@birliy.app`
  const name  = `Dev ${role.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}`

  const adminClient = createServiceClient()

  // Get or create dev auth user
  const { data: existingUser } = await adminClient
    .from('users')
    .select('id, role')
    .eq('telegram_id', telegramId)
    .maybeSingle()

  let userId: string

  if (existingUser) {
    userId = existingUser.id
    // Elevate or demote platform role only when super_admin is involved.
    if (role === 'super_admin' && existingUser.role !== 'super_admin') {
      await adminClient.from('users').update({ role: 'super_admin' }).eq('id', userId)
    } else if (role !== 'super_admin' && existingUser.role === 'super_admin') {
      await adminClient.from('users').update({ role: normalizePlatformRole(role) }).eq('id', userId)
    }
  } else {
    const { data: authData } = await adminClient.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { telegram_id: telegramId, name },
    })

    const authUserId = authData?.user?.id ?? await findAuthUserByEmail(email)
    if (!authUserId) {
      return NextResponse.json(err('DEV_AUTH_ERROR', 'Failed to create dev user'), { status: 500 })
    }

    userId = authUserId
    await adminClient.from('users').upsert({
      id:          userId,
      telegram_id: telegramId,
      name,
      role: normalizePlatformRole(role),
    })
  }

  if (role !== 'super_admin') {
    const shopRole = inferShopRoleFromUserRole(role as Exclude<UserRole, 'super_admin'>)
    const { error: membershipError } = await adminClient
      .from('shop_users')
      .upsert(
        { shop_id: DEV_DEMO_SHOP_ID, user_id: userId, role: shopRole },
        { onConflict: 'shop_id,user_id' },
      )

    if (membershipError) {
      console.error('[auth] dev membership upsert failed:', membershipError)
      return NextResponse.json(err('DEV_AUTH_ERROR', 'Failed to assign dev user to demo shop'), { status: 500 })
    }
  }

  const context      = await getUserContext(userId)
  const shopIds      = context.shopAccess.map((e) => e.shop_id)
  const sessionToken = await signSession({
    userId,
    appRole:        context.appRole,
    shopIds,
    primaryShopId:  context.primaryShopId,
    subscriptionOk: context.subscriptionOk,
  })

  const payload: AuthResponse = {
    user:            context.user,
    role:            context.appRole,
    has_shop_access: context.hasShopAccess,
    subscription_ok: context.subscriptionOk,
    primary_shop_id: context.primaryShopId,
  }

  const response = NextResponse.json(ok<AuthResponse>(payload))
  response.cookies.set(SESSION_COOKIE, sessionToken, getSessionCookieOptions())
  return response
}

// ─── Utility: look up auth user by email via admin API ───────────────────────

async function findAuthUserByEmail(email: string): Promise<string | null> {
  const adminClient = createServiceClient()
  // Supabase admin.listUsers supports filtering; use a targeted approach
  let page = 1
  while (page <= 10) { // safety cap
    const { data } = await adminClient.auth.admin.listUsers({ page, perPage: 50 })
    if (!data?.users?.length) break
    const found = data.users.find((u) => u.email === email)
    if (found) return found.id
    if (data.users.length < 50) break
    page++
  }
  return null
}
