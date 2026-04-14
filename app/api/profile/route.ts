import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/auth/getUser'
import { getSessionCookieOptions, SESSION_COOKIE } from '@/lib/auth/session'
import { err, ok } from '@/lib/utils'
import { normalizeAppLanguage } from '@/lib/appLanguage'
import type { AppUser } from '@/lib/types'

export async function GET() {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json(err('UNAUTHENTICATED', 'Authentication required'), { status: 401 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', sessionUser.userId)
    .single()

  if (error || !data) {
    return NextResponse.json(err('USER_NOT_FOUND', 'Профиль не найден'), { status: 404 })
  }

  return NextResponse.json(ok<{ user: AppUser }>({ user: data as AppUser }))
}

export async function PATCH(req: NextRequest) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json(err('UNAUTHENTICATED', 'Authentication required'), { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const updates: Record<string, string | null> = {}

  if (typeof body.name === 'string') {
    const nextName = body.name.trim()
    if (nextName.length < 1 || nextName.length > 120) {
      return NextResponse.json(err('INVALID_NAME', 'Имя должно содержать от 1 до 120 символов'), { status: 400 })
    }
    updates.name = nextName
  }

  if (typeof body.username === 'string' || body.username === null) {
    const nextUsername =
      typeof body.username === 'string'
        ? body.username.trim().replace(/^@+/, '')
        : null

    if (nextUsername && nextUsername.length > 64) {
      return NextResponse.json(err('INVALID_USERNAME', 'Username слишком длинный'), { status: 400 })
    }

    updates.username = nextUsername || null
  }

  if (body.preferred_language !== undefined) {
    if (body.preferred_language !== 'ru' && body.preferred_language !== 'uz') {
      return NextResponse.json(err('INVALID_LANGUAGE', 'Поддерживаются только ru и uz'), { status: 400 })
    }
    updates.preferred_language = normalizeAppLanguage(body.preferred_language)
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(err('NO_CHANGES', 'Нет данных для обновления'), { status: 400 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', sessionUser.userId)
    .select('*')
    .single()

  if (error || !data) {
    return NextResponse.json(err('UPDATE_FAILED', 'Не удалось обновить профиль'), { status: 500 })
  }

  await supabase.auth.admin.updateUserById(sessionUser.userId, {
    user_metadata: {
      telegram_id: data.telegram_id,
      name: data.name,
      username: data.username,
      preferred_language: data.preferred_language ?? 'ru',
    },
  }).catch(() => null)

  return NextResponse.json(ok<{ user: AppUser }>({ user: data as AppUser }))
}

export async function DELETE() {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json(err('UNAUTHENTICATED', 'Authentication required'), { status: 401 })
  }

  if (sessionUser.role === 'super_admin') {
    return NextResponse.json(
      err('DELETE_BLOCKED', 'Супер-админ не может удалить аккаунт через mini app'),
      { status: 409 },
    )
  }

  const supabase = createServiceClient()

  const [{ count: ordersCount }, { count: bookingsCount }, membershipsRes] = await Promise.all([
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('waiter_id', sessionUser.userId),
    supabase.from('table_bookings').select('id', { count: 'exact', head: true }).eq('booked_by', sessionUser.userId),
    supabase.from('shop_users').select('shop_id, role').eq('user_id', sessionUser.userId),
  ])

  if ((ordersCount ?? 0) > 0 || (bookingsCount ?? 0) > 0) {
    return NextResponse.json(
      err('DELETE_BLOCKED', 'Аккаунт нельзя удалить, потому что за ним уже есть история операций'),
      { status: 409 },
    )
  }

  const memberships = membershipsRes.data ?? []
  const ownerShopIds = memberships
    .filter((membership) => membership.role === 'owner')
    .map((membership) => membership.shop_id)

  if (ownerShopIds.length > 0) {
    const { data: owners } = await supabase
      .from('shop_users')
      .select('shop_id, user_id')
      .in('shop_id', ownerShopIds)
      .eq('role', 'owner')

    const soleOwnerShops = ownerShopIds.filter((shopId) => {
      const otherOwners = (owners ?? []).filter((entry) => entry.shop_id === shopId && entry.user_id !== sessionUser.userId)
      return otherOwners.length === 0
    })

    if (soleOwnerShops.length > 0) {
      return NextResponse.json(
        err('DELETE_BLOCKED', 'Сначала передайте владение заведением другому пользователю'),
        { status: 409 },
      )
    }
  }

  const { error: deleteError } = await supabase.auth.admin.deleteUser(sessionUser.userId)
  if (deleteError) {
    return NextResponse.json(err('DELETE_FAILED', 'Не удалось удалить аккаунт'), { status: 500 })
  }

  const response = NextResponse.json(ok({ deleted: true }))
  response.cookies.set(SESSION_COOKIE, '', getSessionCookieOptions({ maxAge: 0 }))
  return response
}
