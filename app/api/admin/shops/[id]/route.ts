import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/auth/apiGuard'
import { err, ok } from '@/lib/utils'

/**
 * GET /api/admin/shops/[id]
 * Single shop detail: shop fields, subscription, staff list.
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
    .from('shops')
    .select(`
      id, name, address, phone, is_active, created_at, updated_at,
      subscription:subscriptions (id, status, plan, expires_at, created_at, updated_at),
      members:shop_users (
        id, role, created_at,
        user:users (id, name, username, telegram_id, role)
      )
    `)
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json(err('NOT_FOUND', 'Shop not found'), { status: 404 })
    }
    console.error('[admin/shops/[id] GET]', error)
    return NextResponse.json(err('DB_ERROR', 'Failed to fetch shop'), { status: 500 })
  }

  return NextResponse.json(ok(data))
}

/**
 * PATCH /api/admin/shops/[id]
 * Update shop name, address, phone, or is_active.
 * Requires: super_admin.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireSuperAdmin()
  if (!guard.ok) return guard.response

  const { id } = await params
  let body: { name?: string; address?: string; phone?: string; is_active?: boolean }
  try { body = await req.json() } catch { body = {} }

  const patch: Record<string, unknown> = {}
  if (body.name    !== undefined) patch.name      = body.name.trim()
  if (body.address !== undefined) patch.address   = body.address || null
  if (body.phone   !== undefined) patch.phone     = body.phone || null
  if (body.is_active !== undefined) patch.is_active = body.is_active

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(err('VALIDATION', 'No fields to update'), { status: 400 })
  }
  if (patch.name === '') {
    return NextResponse.json(err('VALIDATION', 'name cannot be empty'), { status: 400 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('shops')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('[admin/shops/[id] PATCH]', error)
    return NextResponse.json(err('DB_ERROR', 'Failed to update shop'), { status: 500 })
  }

  return NextResponse.json(ok(data))
}

/**
 * DELETE /api/admin/shops/[id]
 * Soft-delete (set is_active=false) or hard delete if no orders exist.
 * For safety we only soft-delete: set is_active = false.
 * Requires: super_admin.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireSuperAdmin()
  if (!guard.ok) return guard.response

  const { id } = await params
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('shops')
    .update({ is_active: false })
    .eq('id', id)

  if (error) {
    console.error('[admin/shops/[id] DELETE]', error)
    return NextResponse.json(err('DB_ERROR', 'Failed to deactivate shop'), { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
