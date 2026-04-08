import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/auth/apiGuard'
import { err, ok } from '@/lib/utils'

const VALID_ROLES = ['super_admin', 'owner', 'waiter'] as const
const VALID_SHOP_ROLES = ['owner', 'waiter'] as const
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

  return NextResponse.json(ok(data))
}

/**
 * PATCH /api/admin/users/[id]
 * Update a user's platform role and optionally attach them to a shop.
 * Body: {
 *   role: 'super_admin' | 'owner' | 'waiter',
 *   shop_id?: string,
 *   shop_role?: 'owner' | 'waiter',
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

  let shopId = body.shop_id?.trim() || ''
  const shopRole =
    body.shop_role && VALID_SHOP_ROLES.includes(body.shop_role as (typeof VALID_SHOP_ROLES)[number])
      ? body.shop_role as (typeof VALID_SHOP_ROLES)[number]
      : role === 'owner'
        ? 'owner'
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
      err('VALIDATION', 'shop_id is required for owner/waiter'),
      { status: 400 },
    )
  }

  const { error: updateError } = await supabase
    .from('users')
    .update({ role })
    .eq('id', id)

  if (updateError) {
    console.error('[admin/users/[id] PATCH update role]', updateError)
    return NextResponse.json(err('DB_ERROR', 'Failed to update user role'), { status: 500 })
  }

  if (role !== 'super_admin') {
    const { error: membershipError } = await supabase
      .from('shop_users')
      .upsert(
        { shop_id: shopId, user_id: id, role: shopRole },
        { onConflict: 'shop_id,user_id' },
      )

    if (membershipError) {
      console.error('[admin/users/[id] PATCH upsert membership]', membershipError)
      return NextResponse.json(err('DB_ERROR', 'Failed to assign user to shop'), { status: 500 })
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

  return NextResponse.json(ok(data))
}
