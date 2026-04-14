import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth, requireManagementAccess } from '@/lib/auth/apiGuard'
import { err, ok } from '@/lib/utils'
import { mapAdminUser, type AdminUserRecord } from '@/lib/admin/userUtils'
import type { ShopUserRole, UserRole } from '@/lib/types'
import { inferShopRoleFromUserRole, normalizePlatformRole } from '@/lib/roles'
import { syncUserRoleFromMemberships, UNAUTHORIZED_USER_ROLE } from '@/lib/userRoleSync'

const VALID_ROLES = ['super_admin', 'unauthorized', 'owner', 'manager', 'waiter', 'kitchen'] as const
const VALID_SHOP_ROLES = ['owner', 'manager', 'waiter', 'kitchen'] as const
const DEFAULT_DEMO_SHOP_ID = '00000000-0000-0000-0000-000000000001'

/**
 * GET /api/admin/users?role=waiter&search=text
 * List all platform users with their shop memberships.
 * Optional query params:
 *   role   — filter by user_role (super_admin | unauthorized | owner | manager | waiter | kitchen)
 *   search — partial match on name or username (case-insensitive)
 * Requires: super_admin.
 * Owner dashboard may also call this endpoint with ?shop_id=... to search
 * existing users for assignment into the current shop.
 */
export async function GET(req: NextRequest) {
  const role   = req.nextUrl.searchParams.get('role')
  const search = req.nextUrl.searchParams.get('search')?.trim()
  const shopId = req.nextUrl.searchParams.get('shop_id')

  const authGuard = await requireAuth()
  if (!authGuard.ok) return authGuard.response

  const isSuperAdmin = authGuard.value.role === 'super_admin'
  if (!isSuperAdmin) {
    const managementGuard = await requireManagementAccess(shopId)
    if (!managementGuard.ok) return managementGuard.response
  }

  const supabase = createServiceClient()

  let query = supabase
    .from('users')
    .select(`
      id, telegram_id, name, username, role, created_at, updated_at,
      shops:shop_users (
        id, role, shop_id, created_at,
        shop:shops (id, name, is_active)
      )
    `)
    .order('created_at', { ascending: false })

  if (search) {
    const normalizedSearch = search.replace(/^@+/, '')
    const searchConditions = [
      `name.ilike.%${search}%`,
      `username.ilike.%${normalizedSearch}%`,
    ]

    if (/^\d+$/.test(search)) {
      searchConditions.push(`telegram_id.eq.${search}`)
    }

    query = query.or(searchConditions.join(','))
  }
  if (!isSuperAdmin) {
    query = query.neq('role', 'super_admin')
  }

  const { data, error } = await query

  if (error) {
    console.error('[admin/users GET]', error)
    return NextResponse.json(err('DB_ERROR', 'Failed to fetch users'), { status: 500 })
  }

  const users = ((data ?? []) as AdminUserRecord[]).map((user) => mapAdminUser(user))
  const filtered = role
    ? users.filter((user) => user.role === role)
    : users

  return NextResponse.json(ok(filtered))
}

/**
 * POST /api/admin/users
 * Super-admin helper for quickly finding or bootstrapping a user by Telegram ID,
 * or finding an existing user by username, then assigning a role/shop.
 */
export async function POST(req: NextRequest) {
  const authGuard = await requireAuth()
  if (!authGuard.ok) return authGuard.response

  if (authGuard.value.role !== 'super_admin') {
    return NextResponse.json(err('FORBIDDEN', 'Super admin access required'), { status: 403 })
  }

  let body: {
    identifier?: string
    role?: UserRole
    shop_id?: string | null
    shop_role?: ShopUserRole | null
    name?: string | null
    username?: string | null
  }

  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const identifier = body.identifier?.trim() ?? ''
  if (!identifier) {
    return NextResponse.json(err('VALIDATION', 'identifier is required'), { status: 400 })
  }

  if (!body.role || !VALID_ROLES.includes(body.role)) {
    return NextResponse.json(
      err('VALIDATION', `role must be one of: ${VALID_ROLES.join(', ')}`),
      { status: 400 },
    )
  }

  const supabase = createServiceClient()
  const role = body.role
  const isTelegramId = /^\d+$/.test(identifier)
  const normalizedUsername = identifier.replace(/^@+/, '').trim()

  let userId: string | null = null

  if (isTelegramId) {
    const telegramId = Number(identifier)
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('telegram_id', telegramId)
      .maybeSingle()

    if (existingUser?.id) {
      userId = existingUser.id
    } else {
      const email = `t_${telegramId}@birliy.app`
      const fallbackName = body.name?.trim() || `User ${telegramId}`
      const fallbackUsername = body.username?.trim().replace(/^@+/, '') || null

      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          telegram_id: telegramId,
          name: fallbackName,
          username: fallbackUsername,
        },
      })

      if (authError && !authError.message?.includes('already been registered')) {
        console.error('[admin/users POST createUser]', authError)
        return NextResponse.json(err('AUTH_ERROR', 'Failed to create auth user'), { status: 500 })
      }

      userId = authData?.user?.id ?? await findAuthUserByEmail(email)
      if (!userId) {
        return NextResponse.json(err('AUTH_ERROR', 'Failed to resolve auth user'), { status: 500 })
      }

      const { error: insertError } = await supabase
        .from('users')
        .upsert({
          id: userId,
          telegram_id: telegramId,
          name: fallbackName,
          username: fallbackUsername,
          role: role === 'super_admin' ? 'super_admin' : normalizePlatformRole(role),
        })

      if (insertError) {
        console.error('[admin/users POST insert user]', insertError)
        return NextResponse.json(err('DB_ERROR', 'Failed to create platform user'), { status: 500 })
      }
    }
  } else {
    const { data: existingUsers, error: lookupError } = await supabase
      .from('users')
      .select('id')
      .ilike('username', normalizedUsername)
      .limit(1)

    if (lookupError) {
      console.error('[admin/users POST lookup username]', lookupError)
      return NextResponse.json(err('DB_ERROR', 'Failed to find user by username'), { status: 500 })
    }

    userId = existingUsers?.[0]?.id ?? null
    if (!userId) {
      return NextResponse.json(
        err(
          'USER_NOT_FOUND',
          'Пользователь с таким username ещё не входил в систему. Для нового пользователя используйте Telegram ID.',
        ),
        { status: 404 },
      )
    }
  }

  if (!userId) {
    return NextResponse.json(err('USER_NOT_FOUND', 'Не удалось определить пользователя для назначения'), { status: 404 })
  }

  const resolvedUserId = userId

  const assignmentTimestamp = new Date().toISOString()
  let shopId = body.shop_id?.trim() || ''
  const shopRole =
    body.shop_role && VALID_SHOP_ROLES.includes(body.shop_role)
      ? body.shop_role
      : role === 'super_admin' || role === 'unauthorized'
        ? 'waiter'
        : inferShopRoleFromUserRole(role)

  if (role !== 'super_admin' && role !== 'unauthorized' && !shopId) {
    const { data: demoShop } = await supabase
      .from('shops')
      .select('id')
      .eq('id', DEFAULT_DEMO_SHOP_ID)
      .maybeSingle()

    if (demoShop?.id) {
      shopId = demoShop.id
    } else {
      const { data: firstShop } = await supabase
        .from('shops')
        .select('id')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      shopId = firstShop?.id ?? ''
    }
  }

  if (role !== 'super_admin' && role !== 'unauthorized' && !shopId) {
    return NextResponse.json(
      err('VALIDATION', 'shop_id is required for owner/manager/waiter/kitchen'),
      { status: 400 },
    )
  }

  const nextPlatformRole = role === 'unauthorized' ? UNAUTHORIZED_USER_ROLE : normalizePlatformRole(role)
  const { error: updateError } = await supabase
    .from('users')
    .update({ role: nextPlatformRole })
    .eq('id', resolvedUserId)

  if (updateError) {
    console.error('[admin/users POST update role]', updateError)
    return NextResponse.json(err('DB_ERROR', 'Failed to update user role'), { status: 500 })
  }

  if (role === 'unauthorized') {
    const { error: deleteMembershipsError } = await supabase
      .from('shop_users')
      .delete()
      .eq('user_id', resolvedUserId)

    if (deleteMembershipsError) {
      console.error('[admin/users POST clear memberships]', deleteMembershipsError)
      return NextResponse.json(err('DB_ERROR', 'Failed to clear user memberships'), { status: 500 })
    }
  } else if (role !== 'super_admin') {
    const { data: existingMembership, error: membershipFetchError } = await supabase
      .from('shop_users')
      .select('id')
      .eq('shop_id', shopId)
      .eq('user_id', resolvedUserId)
      .maybeSingle()

    if (membershipFetchError) {
      console.error('[admin/users POST inspect membership]', membershipFetchError)
      return NextResponse.json(err('DB_ERROR', 'Failed to inspect shop membership'), { status: 500 })
    }

    if (existingMembership?.id) {
      const { error: membershipUpdateError } = await supabase
        .from('shop_users')
        .update({ role: shopRole, created_at: assignmentTimestamp })
        .eq('id', existingMembership.id)

      if (membershipUpdateError) {
        console.error('[admin/users POST update membership]', membershipUpdateError)
        return NextResponse.json(err('DB_ERROR', 'Failed to assign user to shop'), { status: 500 })
      }
    } else {
      const { error: membershipInsertError } = await supabase
        .from('shop_users')
        .insert({
          shop_id: shopId,
          user_id: resolvedUserId,
          role: shopRole,
          created_at: assignmentTimestamp,
        })

      if (membershipInsertError) {
        console.error('[admin/users POST insert membership]', membershipInsertError)
        return NextResponse.json(err('DB_ERROR', 'Failed to assign user to shop'), { status: 500 })
      }
    }
  }

  if (role !== 'super_admin') {
    const { error: syncError } = await syncUserRoleFromMemberships(
      resolvedUserId,
      role === 'unauthorized' ? UNAUTHORIZED_USER_ROLE : role,
    )

    if (syncError) {
      console.error('[admin/users POST sync role]', syncError)
      return NextResponse.json(err('DB_ERROR', 'Failed to sync user role'), { status: 500 })
    }
  }

  const { data, error } = await supabase
    .from('users')
    .select(`
      id, telegram_id, name, username, role, created_at, updated_at,
      shops:shop_users (
        id, role, shop_id, created_at,
        shop:shops (id, name, is_active)
      )
    `)
    .eq('id', resolvedUserId)
    .single()

  if (error) {
    console.error('[admin/users POST fetch updated user]', error)
    return NextResponse.json(err('DB_ERROR', 'Failed to fetch created user'), { status: 500 })
  }

  return NextResponse.json(ok(mapAdminUser(data as AdminUserRecord)))
}

async function findAuthUserByEmail(email: string): Promise<string | null> {
  const adminClient = createServiceClient()
  let page = 1

  while (page <= 10) {
    const { data } = await adminClient.auth.admin.listUsers({ page, perPage: 50 })
    if (!data?.users?.length) break

    const found = data.users.find((user) => user.email === email)
    if (found) return found.id
    if (data.users.length < 50) break

    page += 1
  }

  return null
}
