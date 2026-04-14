import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireShopAdminAccess } from '@/lib/auth/apiGuard'
import { err, ok } from '@/lib/utils'
import { canAssignShopRole, canRemoveStaffRole, isManagementShopRole } from '@/lib/roles'
import { setNonSuperAdminUserRole, syncUserRoleFromMemberships } from '@/lib/userRoleSync'

/**
 * POST /api/admin/shops/[id]/members
 * Assign a user to a shop with a given role.
 * If the user already belongs to this shop, updates their role.
 * Body: { user_id, role }
 * Requires: super_admin, owner or manager of this shop.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: shopId } = await params
  const guard = await requireShopAdminAccess(shopId)
  if (!guard.ok) return guard.response
  let body: { user_id?: string; role?: string }
  try { body = await req.json() } catch { body = {} }

  const { user_id, role } = body
  if (!user_id) {
    return NextResponse.json(err('VALIDATION', 'user_id is required'), { status: 400 })
  }
  if (role !== 'owner' && role !== 'manager' && role !== 'waiter' && role !== 'kitchen') {
    return NextResponse.json(err('VALIDATION', 'role must be owner, manager, waiter or kitchen'), { status: 400 })
  }

  const actorRole = guard.value.platformRole === 'super_admin'
    ? 'super_admin'
    : isManagementShopRole(guard.value.shopRole)
      ? guard.value.shopRole
      : null

  if (!actorRole) {
    return NextResponse.json(err('FORBIDDEN', 'Shop management access required'), { status: 403 })
  }

  if (!canAssignShopRole(actorRole, role)) {
    return NextResponse.json(err('FORBIDDEN', 'You cannot assign this role'), { status: 403 })
  }

  const supabase = createServiceClient()
  const assignmentTimestamp = new Date().toISOString()

  // Verify user exists
  const { data: user, error: userErr } = await supabase
    .from('users')
    .select('id, name, role')
    .eq('id', user_id)
    .single()

  if (userErr || !user) {
    return NextResponse.json(err('NOT_FOUND', 'User not found'), { status: 404 })
  }

  const { data: existingMembership, error: membershipFetchError } = await supabase
    .from('shop_users')
    .select('id')
    .eq('shop_id', shopId)
    .eq('user_id', user_id)
    .maybeSingle()

  if (membershipFetchError) {
    console.error('[admin/shops/[id]/members POST fetch membership]', membershipFetchError)
    return NextResponse.json(err('DB_ERROR', 'Failed to inspect shop membership'), { status: 500 })
  }

  const membershipMutation = existingMembership?.id
    ? await supabase
        .from('shop_users')
        .update({ role, created_at: assignmentTimestamp })
        .eq('id', existingMembership.id)
        .select(`
          id, shop_id, user_id, role, created_at,
          user:users (id, name, username, telegram_id, role)
        `)
        .single()
    : await supabase
        .from('shop_users')
        .insert({
          shop_id: shopId,
          user_id,
          role,
          created_at: assignmentTimestamp,
        })
        .select(`
          id, shop_id, user_id, role, created_at,
          user:users (id, name, username, telegram_id, role)
        `)
        .single()

  const { data, error } = membershipMutation

  if (error) {
    console.error('[admin/shops/[id]/members POST]', error)
    return NextResponse.json(err('DB_ERROR', 'Failed to assign member'), { status: 500 })
  }

  const { error: roleSyncError } = await setNonSuperAdminUserRole(user_id, role)
  if (roleSyncError) {
    console.error('[admin/shops/[id]/members POST sync role]', roleSyncError)
    return NextResponse.json(err('DB_ERROR', 'Failed to sync user role'), { status: 500 })
  }

  return NextResponse.json(ok(data), { status: 201 })
}

/**
 * DELETE /api/admin/shops/[id]/members?user_id=xxx
 * Remove a user from the shop.
 * Requires: super_admin, owner or manager of this shop.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: shopId } = await params
  const guard = await requireShopAdminAccess(shopId)
  if (!guard.ok) return guard.response
  const userId = req.nextUrl.searchParams.get('user_id')
  if (!userId) {
    return NextResponse.json(err('VALIDATION', 'user_id is required'), { status: 400 })
  }

  if (guard.value.platformRole !== 'super_admin' && userId === guard.value.userId) {
    return NextResponse.json(
      err('FORBIDDEN', 'You cannot remove yourself from the shop'),
      { status: 403 },
    )
  }

  const supabase = createServiceClient()
  const { data: existingMembership, error: membershipError } = await supabase
    .from('shop_users')
    .select('id, role')
    .eq('shop_id', shopId)
    .eq('user_id', userId)
    .maybeSingle()

  if (membershipError) {
    console.error('[admin/shops/[id]/members DELETE membership]', membershipError)
    return NextResponse.json(err('DB_ERROR', 'Failed to inspect shop membership'), { status: 500 })
  }

  if (!existingMembership) {
    return NextResponse.json(err('NOT_FOUND', 'Membership not found'), { status: 404 })
  }

  const actorRole = guard.value.platformRole === 'super_admin'
    ? 'super_admin'
    : isManagementShopRole(guard.value.shopRole)
      ? guard.value.shopRole
      : null

  if (!actorRole) {
    return NextResponse.json(err('FORBIDDEN', 'Shop management access required'), { status: 403 })
  }

  if (!canRemoveStaffRole(actorRole, existingMembership.role)) {
    return NextResponse.json(err('FORBIDDEN', 'You cannot remove this role from the shop'), { status: 403 })
  }

  const { error } = await supabase
    .from('shop_users')
    .delete()
    .eq('shop_id', shopId)
    .eq('user_id', userId)

  if (error) {
    console.error('[admin/shops/[id]/members DELETE]', error)
    return NextResponse.json(err('DB_ERROR', 'Failed to remove member'), { status: 500 })
  }

  const { error: roleSyncError } = await syncUserRoleFromMemberships(userId)
  if (roleSyncError) {
    console.error('[admin/shops/[id]/members DELETE sync role]', roleSyncError)
    return NextResponse.json(err('DB_ERROR', 'Failed to sync user role'), { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
