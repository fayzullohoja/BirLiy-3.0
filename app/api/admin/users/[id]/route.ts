import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/auth/apiGuard'
import { err, ok } from '@/lib/utils'

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
 * Update a user's platform role.
 * Body: { role: 'super_admin' | 'owner' | 'waiter' }
 * Requires: super_admin.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireSuperAdmin()
  if (!guard.ok) return guard.response

  const { id } = await params
  let body: { role?: string }
  try { body = await req.json() } catch { body = {} }

  const VALID_ROLES = ['super_admin', 'owner', 'waiter']
  if (!body.role || !VALID_ROLES.includes(body.role)) {
    return NextResponse.json(
      err('VALIDATION', `role must be one of: ${VALID_ROLES.join(', ')}`),
      { status: 400 },
    )
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('users')
    .update({ role: body.role })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('[admin/users/[id] PATCH]', error)
    return NextResponse.json(err('DB_ERROR', 'Failed to update user role'), { status: 500 })
  }

  return NextResponse.json(ok(data))
}
