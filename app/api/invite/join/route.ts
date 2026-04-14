import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/apiGuard'
import { ok, err } from '@/lib/utils'
import { isValidInviteCode, normalizeInviteCode } from '@/lib/inviteCodes'
import { resolveInviteCodeByCode } from '@/lib/inviteCodeResolver'
import type { ShopUserRole } from '@/lib/types'

/**
 * Legacy compatibility route.
 * Preserves the old endpoint shape while using the new role-based invite codes.
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth()
    if (!authResult.ok) return authResult.response

    const body = await req.json().catch(() => ({}))
    const code = normalizeInviteCode(String(body?.code ?? ''))
    if (!isValidInviteCode(code)) {
      return NextResponse.json(err('INVALID_CODE', 'Введите корректный 8-значный код'), { status: 400 })
    }

    const supabase = createServiceClient()
    const { inviteCode, error: inviteError, source } = await resolveInviteCodeByCode(code)

    if (inviteError) {
      console.error(`[invite/join ${source}]`, inviteError)
      return NextResponse.json(err('DB_ERROR', 'Failed to inspect invite code'), { status: 500 })
    }

    if (!inviteCode) {
      return NextResponse.json(
        err('INVALID_CODE', 'Неверный код приглашения. Проверьте и попробуйте снова.'),
        { status: 404 },
      )
    }

    const shop = inviteCode.shop
    if (!shop?.is_active) {
      return NextResponse.json(
        err('SHOP_INACTIVE', 'Это заведение неактивно. Обратитесь к владельцу.'),
        { status: 403 },
      )
    }

    const { userId } = authResult.value

    const { data: existingSameShop, error: sameShopError } = await supabase
      .from('shop_users')
      .select('id, role')
      .eq('shop_id', inviteCode.shop_id)
      .eq('user_id', userId)
      .maybeSingle()

    if (sameShopError) {
      console.error('[invite/join same shop]', sameShopError)
      return NextResponse.json(err('DB_ERROR', 'Failed to inspect current membership'), { status: 500 })
    }

    if (existingSameShop?.role === inviteCode.role) {
      return NextResponse.json(ok({
        shop_id: inviteCode.shop_id,
        shop_name: shop.name,
        role: inviteCode.role,
        already_member: true,
      }))
    }

    if (existingSameShop && existingSameShop.role !== inviteCode.role) {
      return NextResponse.json(
        err('ROLE_CONFLICT', 'Вы уже привязаны к этому заведению с другой ролью. Обратитесь к владельцу.'),
        { status: 409 },
      )
    }

    const { data: existingStaffRoles, error: existingStaffRolesError } = await supabase
      .from('shop_users')
      .select('shop_id, role')
      .eq('user_id', userId)
      .in('role', ['manager', 'waiter', 'kitchen'])
      .neq('shop_id', inviteCode.shop_id)

    if (existingStaffRolesError) {
      console.error('[invite/join other shops]', existingStaffRolesError)
      return NextResponse.json(err('DB_ERROR', 'Failed to inspect existing memberships'), { status: 500 })
    }

    if ((existingStaffRoles ?? []).length > 0) {
      return NextResponse.json(
        err('SHOP_CONFLICT', 'Вы уже прикреплены к другому заведению. Обратитесь к владельцу или администратору.'),
        { status: 409 },
      )
    }

    const { error: insertError } = await supabase
      .from('shop_users')
      .insert({
        shop_id: inviteCode.shop_id,
        user_id: userId,
        role: inviteCode.role as ShopUserRole,
        created_at: new Date().toISOString(),
      })

    if (insertError) {
      console.error('[invite/join insert]', insertError)
      return NextResponse.json(
        err('DB_ERROR', 'Не удалось присоединиться. Попробуйте снова.'),
        { status: 500 },
      )
    }

    return NextResponse.json(ok({
      shop_id: inviteCode.shop_id,
      shop_name: shop.name,
      role: inviteCode.role,
      already_member: false,
    }))
  } catch (e) {
    console.error('[invite/join POST] unexpected:', e)
    return NextResponse.json(err('INTERNAL_ERROR', 'Internal server error'), { status: 500 })
  }
}
