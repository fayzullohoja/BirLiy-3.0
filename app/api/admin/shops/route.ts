import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/auth/apiGuard'
import { err, ok } from '@/lib/utils'

/**
 * GET /api/admin/shops
 * List all shops with their subscription and owner info.
 * Requires: super_admin.
 */
export async function GET() {
  const guard = await requireSuperAdmin()
  if (!guard.ok) return guard.response

  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('shops')
    .select(`
      id, name, address, phone, is_active, created_at, updated_at,
      subscription:subscriptions (id, status, plan, expires_at),
      members:shop_users (
        id, role,
        user:users (id, name, username, telegram_id, role)
      )
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[admin/shops GET]', error)
    return NextResponse.json(err('DB_ERROR', 'Failed to fetch shops'), { status: 500 })
  }

  return NextResponse.json(ok(data ?? []))
}

/**
 * POST /api/admin/shops
 * Create a new shop and automatically attach a trial subscription (30 days).
 * Body: { name, address?, phone? }
 * Requires: super_admin.
 */
export async function POST(req: NextRequest) {
  const guard = await requireSuperAdmin()
  if (!guard.ok) return guard.response

  let body: { name?: string; address?: string; phone?: string }
  try { body = await req.json() } catch { body = {} }

  const name = (body.name ?? '').trim()
  if (!name) {
    return NextResponse.json(err('VALIDATION', 'name is required'), { status: 400 })
  }

  const supabase = createServiceClient()

  // Create shop
  const { data: shop, error: shopErr } = await supabase
    .from('shops')
    .insert({ name, address: body.address ?? null, phone: body.phone ?? null })
    .select()
    .single()

  if (shopErr || !shop) {
    console.error('[admin/shops POST]', shopErr)
    return NextResponse.json(err('DB_ERROR', 'Failed to create shop'), { status: 500 })
  }

  // Create trial subscription (30 days)
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  const { error: subErr } = await supabase
    .from('subscriptions')
    .insert({ shop_id: shop.id, status: 'trial', plan: 'trial', expires_at: expiresAt })

  if (subErr) {
    console.error('[admin/shops POST sub]', subErr)
    // Shop was created — still return it; subscription creation failure is logged
  }

  return NextResponse.json(ok(shop), { status: 201 })
}
