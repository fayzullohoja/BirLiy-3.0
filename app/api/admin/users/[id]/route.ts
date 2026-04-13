import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/auth/apiGuard'
import { err, ok } from '@/lib/utils'
import { mapAdminUser, type AdminUserRecord } from '@/lib/admin/userUtils'

const VALID_ROLES = ['super_admin', 'owner', 'waiter', 'kitchen'] as const
const VALID_SHOP_ROLES = ['owner', 'waiter', 'kitchen'] as const
const DEFAULT_DEMO_SHOP_ID = '00000000-0000-0000-0000-000000000001'

/**
 * GET /api/admin/users/[id]
 * Single user detail with shop memberships.
 * Requires: super_admin.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireSuperAdmin()
  if (!guard.ok) return guard.response

  const { id } = await params
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('users')
    .select(`
      id, telegram_id, name, username, role, created_at, updated_at,
      shops:shop_users (
        id, role, shop_id, created_at,
        shop:shops (id, name, is_active,
          subscription:subscriptions (status, plan, expires_at)
        )
      )
    `)
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json(err('NOT_FOUND', 'User not found'), { status: 404 })
    }
    console.error('[admin/users/[id] GET]', error)
    return NextResponse.json(err('DB_ERROR', 'Failed to fetch user'), { status: 500 })
  }

  return NextResponse.json(ok(mapAdminUser(data as AdminUserRecord)))
}

/**
 * PATCH /api/admin/users/[id]
 * Update a user's platform role and optionally attach them to a shop.
 * Body: {
 *   role: 'super_admin' | 'owner' | 'waiter' | 'kitchen',
 *   shop_id?: string,
 *   shop_role?: 'owner' | 'waiter' | 'kitchen',
 * }
 * Requires: super_admin.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireSuperAdmin()
  if (!guard.ok) return guard.response

  const { id } = await params
  let body: { role?: string; shop_id?: string | null; shop_role?: string | null }
  try { body = await req.json() } catch { body = {} }

  if (!body.role || !VALID_ROLES.includes(body.role as (typeof VALID_ROLES)[number])) {
    return NextResponse.json(
      err('VALIDATION', `role must be one of: ${VALID_ROLES.join(', ')}`),
      { status: 400 },
    )
  }

  const supabase = createServiceClient()
  const role = body.role as (typeof VALID_ROLES)[number]
  const assignmentTimestamp = new Date().toISOString()

  const { data: existingUser, error: userError } = await supabase
    .from('users')
    .select('id, role')
    .eq('id', id)
    .single()

  if (userError || !existingUser) {
    if (userError?.code === 'PGRST116') {
      return NextResponse.json(err('NOT_FOUND', 'User not found'), { status: 404 })
    }
    console.error('[admin/users/[id] PATCH fetch user]', userError)
    return NextResponse.json(err('DB_ERROR', 'Failed to load user'), { status: 500 })
  }

  let shopId = body.shop_id?.trim() || ''
  const shopRole =
    body.shop_role && VALID_SHOP_ROLES.includes(body.shop_role as (typeof VALID_SHOP_ROLES)[number])
      ? body.shop_role as (typeof VALID_SHOP_ROLES)[number]
      : role === 'owner'
        ? 'owner'
        : role === 'kitchen'
          ? 'kitchen'
          : 'waiter'

  if (role !== 'super_admin' && !shopId) {
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

  if (role !== 'super_admin' && !shopId) {
    return NextResponse.json(
      err('VALIDATION', 'shop_id is required for owner/waiter/kitchen'),
      { status: 400 },
    )
  }

  // Always sync users.role so the column stays consistent with shop_users.role
  const { error: updateError } = await supabase
    .from('users')
    .update({ role })
    .eq('id', id)

  if (updateError) {
    console.error('[admin/users/[id] PATCH update role]', updateError)
    return NextResponse.json(err('DB_ERROR', 'Failed to update user role'), { status: 500 })
  }

  if (role !== 'super_admin') {
    const { data: existingMembership, error: membershipFetchError } = await supabase
      .from('shop_users')
      .select('id')
      .eq('shop_id', shopId)
      .eq('user_id', id)
      .maybeSingle()

    if (membershipFetchError) {
      console.error('[admin/users/[id] PATCH fetch membership]', membershipFetchError)
      return NextResponse.json(err('DB_ERROR', 'Failed to inspect shop membership'), { status: 500 })
    }

    if (existingMembership?.id) {
      const { error: membershipUpdateError } = await supabase
        .from('shop_users')
        .update({ role: shopRole, created_at: assignmentTimestamp })
        .eq('id', existingMembership.id)

      if (membershipUpdateError) {
        console.error('[admin/users/[id] PATCH update membership]', membershipUpdateError)
        return NextResponse.json(err('DB_ERROR', 'Failed to assign user to shop'), { status: 500 })
      }
    } else {
      const { error: membershipInsertError } = await supabase
        .from('shop_users')
        .insert({
          shop_id: shopId,
          user_id: id,
          role: shopRole,
          created_at: assignmentTimestamp,
        })

      if (membershipInsertError) {
        console.error('[admin/users/[id] PATCH insert membership]', membershipInsertError)
        return NextResponse.json(err('DB_ERROR', 'Failed to assign user to shop'), { status: 500 })
      }
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
    .eq('id', id)
    .single()

  if (error) {
    console.error('[admin/users/[id] PATCH fetch updated user]', error)
    return NextResponse.json(err('DB_ERROR', 'Failed to fetch updated user'), { status: 500 })
  }

  return NextResponse.json(ok(mapAdminUser(data as AdminUserRecord)))
}
