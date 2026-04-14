import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireManagementAccess } from '@/lib/auth/apiGuard'
import { err, ok } from '@/lib/utils'
import type { ShopUser, ShopUserRole } from '@/lib/types'
import { canChangeStaffRole, canRemoveStaffRole, isManagementShopRole } from '@/lib/roles'
import { syncUserRoleFromMemberships, setNonSuperAdminUserRole } from '@/lib/userRoleSync'

/**
 * GET /api/staff?shop_id=xxx
 * Returns all members of the shop with user details.
 * Requires: owner or manager.
 */
export async function GET(req: NextRequest) {
  const shopId = req.nextUrl.searchParams.get('shop_id')
  const guard  = await requireManagementAccess(shopId)
  if (!guard.ok) return guard.response

  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('shop_users')
    .select(`
      id, shop_id, user_id, role, created_at,
      user:users (id, name, username, telegram_id, role, created_at, updated_at)
    `)
    .eq('shop_id', shopId!)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[staff GET]', error)
    return NextResponse.json(err('DB_ERROR', 'Failed to fetch staff'), { status: 500 })
  }

  const staff: ShopUser[] = (data ?? []).map((row) => ({
    ...row,
    user: Array.isArray(row.user) ? row.user[0] : row.user,
  }))

  return NextResponse.json(ok<ShopUser[]>(staff))
}

/**
 * DELETE /api/staff?shop_id=xxx&user_id=yyy
 * Removes a member from the shop.
 * Cannot remove the owner themselves.
 * Requires: owner or manager.
 */
export async function DELETE(req: NextRequest) {
  try {
    const shopId = req.nextUrl.searchParams.get('shop_id')
    const userId = req.nextUrl.searchParams.get('user_id')
    const guard  = await requireManagementAccess(shopId)
    if (!guard.ok) return guard.response

    if (!userId) {
      return NextResponse.json(err('MISSING_PARAM', 'user_id is required'), { status: 400 })
    }

    // Prevent owner from removing themselves
    if (userId === guard.value.userId) {
      return NextResponse.json(
        err('FORBIDDEN', 'You cannot remove yourself from the shop'),
        { status: 403 },
      )
    }

    const supabase = createServiceClient()
    const { data: membership, error: membershipError } = await supabase
      .from('shop_users')
      .select('id, role')
      .eq('shop_id', shopId!)
      .eq('user_id', userId)
      .maybeSingle()

    if (membershipError) {
      console.error('[staff DELETE membership]', membershipError)
      return NextResponse.json(err('DB_ERROR', 'Failed to inspect staff member'), { status: 500 })
    }

    if (!membership) {
      return NextResponse.json(err('NOT_FOUND', 'Staff member not found'), { status: 404 })
    }

    const actorRole = isManagementShopRole(guard.value.shopRole) ? guard.value.shopRole : null
    if (!actorRole) {
      return NextResponse.json(err('FORBIDDEN', 'Management access required'), { status: 403 })
    }

    if (!canRemoveStaffRole(actorRole, membership.role)) {
      return NextResponse.json(
        err('FORBIDDEN', 'Вы не можете удалить сотрудника с этой ролью'),
        { status: 403 },
      )
    }

    const { error } = await supabase
      .from('shop_users')
      .delete()
      .eq('shop_id', shopId!)
      .eq('user_id', userId)

    if (error) {
      console.error('[staff DELETE]', error)
      return NextResponse.json(err('DB_ERROR', 'Failed to remove staff member'), { status: 500 })
    }

    const { error: roleSyncError } = await syncUserRoleFromMemberships(userId)
    if (roleSyncError) {
      console.error('[staff DELETE sync role]', roleSyncError)
      return NextResponse.json(err('DB_ERROR', 'Failed to sync user role'), { status: 500 })
    }

    return new NextResponse(null, { status: 204 })
  } catch (e) {
    console.error('[staff DELETE] unexpected:', e)
    return NextResponse.json(err('INTERNAL_ERROR', 'Internal server error'), { status: 500 })
  }
}

/**
 * PATCH /api/staff
 * Body: { shop_id, user_id, role }
 * Changes a staff member role inside a shop.
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const shopId = body?.shop_id as string | undefined
    const userId = body?.user_id as string | undefined
    const nextRole = body?.role as ShopUserRole | undefined

    const guard = await requireManagementAccess(shopId)
    if (!guard.ok) return guard.response

    if (!userId || !nextRole) {
      return NextResponse.json(err('MISSING_FIELDS', 'shop_id, user_id and role are required'), { status: 400 })
    }

    if (!['owner', 'manager', 'waiter', 'kitchen'].includes(nextRole)) {
      return NextResponse.json(err('VALIDATION', 'Invalid staff role'), { status: 400 })
    }

    if (userId === guard.value.userId) {
      return NextResponse.json(err('FORBIDDEN', 'You cannot change your own shop role here'), { status: 403 })
    }

    const supabase = createServiceClient()
    const { data: membership, error: membershipError } = await supabase
      .from('shop_users')
      .select(`
        id, shop_id, user_id, role, created_at,
        user:users (id, name, username, telegram_id, role, created_at, updated_at)
      `)
      .eq('shop_id', shopId!)
      .eq('user_id', userId)
      .maybeSingle()

    if (membershipError) {
      console.error('[staff PATCH membership]', membershipError)
      return NextResponse.json(err('DB_ERROR', 'Failed to inspect staff member'), { status: 500 })
    }

    if (!membership) {
      return NextResponse.json(err('NOT_FOUND', 'Staff member not found'), { status: 404 })
    }

    const actorRole = isManagementShopRole(guard.value.shopRole) ? guard.value.shopRole : null
    if (!actorRole) {
      return NextResponse.json(err('FORBIDDEN', 'Management access required'), { status: 403 })
    }

    if (!canChangeStaffRole(actorRole, membership.role, nextRole)) {
      return NextResponse.json(
        err('FORBIDDEN', 'Вы не можете назначить эту роль этому сотруднику'),
        { status: 403 },
      )
    }

    const { data, error } = await supabase
      .from('shop_users')
      .update({ role: nextRole, created_at: new Date().toISOString() })
      .eq('id', membership.id)
      .select(`
        id, shop_id, user_id, role, created_at,
        user:users (id, name, username, telegram_id, role, created_at, updated_at)
      `)
      .single()

    if (error) {
      console.error('[staff PATCH update]', error)
      return NextResponse.json(err('DB_ERROR', 'Failed to update staff role'), { status: 500 })
    }

    const { error: roleSyncError } = await setNonSuperAdminUserRole(userId, nextRole)
    if (roleSyncError) {
      console.error('[staff PATCH sync role]', roleSyncError)
      return NextResponse.json(err('DB_ERROR', 'Failed to sync user role'), { status: 500 })
    }

    const normalized: ShopUser = {
      ...data,
      user: Array.isArray(data.user) ? data.user[0] : data.user,
    }

    return NextResponse.json(ok<ShopUser>(normalized))
  } catch (e) {
    console.error('[staff PATCH] unexpected:', e)
    return NextResponse.json(err('INTERNAL_ERROR', 'Internal server error'), { status: 500 })
  }
}
