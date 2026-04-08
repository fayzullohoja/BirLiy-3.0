import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/auth/apiGuard'
import { err, ok } from '@/lib/utils'

/**
 * POST /api/admin/shops/[id]/members
 * Assign a user to a shop with a given role (owner or waiter).
 * If the user already belongs to this shop, updates their role.
 * Body: { user_id, role }
 * Requires: super_admin.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireSuperAdmin()
  if (!guard.ok) return guard.response

  const { id: shopId } = await params
  let body: { user_id?: string; role?: string }
  try { body = await req.json() } catch { body = {} }

  const { user_id, role } = body
  if (!user_id) {
    return NextResponse.json(err('VALIDATION', 'user_id is required'), { status: 400 })
  }
  if (role !== 'owner' && role !== 'waiter') {
    return NextResponse.json(err('VALIDATION', 'role must be owner or waiter'), { status: 400 })
  }

  const supabase = createServiceClient()

  // Verify user exists
  const { data: user, error: userErr } = await supabase
    .from('users')
    .select('id, name, role')
    .eq('id', user_id)
    .single()

  if (userErr || !user) {
    return NextResponse.json(err('NOT_FOUND', 'User not found'), { status: 404 })
  }

  // Upsert membership
  const { data, error } = await supabase
    .from('shop_users')
    .upsert(
      { shop_id: shopId, user_id, role },
      { onConflict: 'shop_id,user_id' },
    )
    .select(`
      id, shop_id, user_id, role, created_at,
      user:users (id, name, username, telegram_id, role)
    `)
    .single()

  if (error) {
    console.error('[admin/shops/[id]/members POST]', error)
    return NextResponse.json(err('DB_ERROR', 'Failed to assign member'), { status: 500 })
  }

  return NextResponse.json(ok(data), { status: 201 })
}

/**
 * DELETE /api/admin/shops/[id]/members?user_id=xxx
 * Remove a user from the shop.
 * Requires: super_admin.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireSuperAdmin()
  if (!guard.ok) return guard.response

  const { id: shopId } = await params
  const userId = req.nextUrl.searchParams.get('user_id')
  if (!userId) {
    return NextResponse.json(err('VALIDATION', 'user_id is required'), { status: 400 })
  }

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('shop_users')
    .delete()
    .eq('shop_id', shopId)
    .eq('user_id', userId)

  if (error) {
    console.error('[admin/shops/[id]/members DELETE]', error)
    return NextResponse.json(err('DB_ERROR', 'Failed to remove member'), { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
