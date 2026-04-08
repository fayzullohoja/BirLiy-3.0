import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/auth/apiGuard'
import { err, ok } from '@/lib/utils'

/**
 * GET /api/admin/subscriptions/[shopId]
 * Get the subscription for a shop.
 * Requires: super_admin.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ shopId: string }> },
) {
  const guard = await requireSuperAdmin()
  if (!guard.ok) return guard.response

  const { shopId } = await params
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('subscriptions')
    .select('*, shop:shops (id, name)')
    .eq('shop_id', shopId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json(err('NOT_FOUND', 'Subscription not found for this shop'), { status: 404 })
    }
    console.error('[admin/subscriptions GET]', error)
    return NextResponse.json(err('DB_ERROR', 'Failed to fetch subscription'), { status: 500 })
  }

  return NextResponse.json(ok(data))
}

/**
 * PATCH /api/admin/subscriptions/[shopId]
 * Update subscription status, plan, and/or expiry date.
 * Body: { status?, plan?, expires_at? }
 * Requires: super_admin.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ shopId: string }> },
) {
  const guard = await requireSuperAdmin()
  if (!guard.ok) return guard.response

  const { shopId } = await params
  let body: { status?: string; plan?: string; expires_at?: string }
  try { body = await req.json() } catch { body = {} }

  const VALID_STATUSES = ['trial', 'active', 'expired', 'suspended']
  const VALID_PLANS    = ['trial', 'starter', 'pro']

  const patch: Record<string, unknown> = {}
  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) {
      return NextResponse.json(
        err('VALIDATION', `status must be one of: ${VALID_STATUSES.join(', ')}`),
        { status: 400 },
      )
    }
    patch.status = body.status
  }
  if (body.plan !== undefined) {
    if (!VALID_PLANS.includes(body.plan)) {
      return NextResponse.json(
        err('VALIDATION', `plan must be one of: ${VALID_PLANS.join(', ')}`),
        { status: 400 },
      )
    }
    patch.plan = body.plan
  }
  if (body.expires_at !== undefined) {
    const d = new Date(body.expires_at)
    if (isNaN(d.getTime())) {
      return NextResponse.json(err('VALIDATION', 'expires_at must be a valid ISO date'), { status: 400 })
    }
    patch.expires_at = d.toISOString()
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(err('VALIDATION', 'No fields to update'), { status: 400 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('subscriptions')
    .update(patch)
    .eq('shop_id', shopId)
    .select()
    .single()

  if (error) {
    console.error('[admin/subscriptions PATCH]', error)
    return NextResponse.json(err('DB_ERROR', 'Failed to update subscription'), { status: 500 })
  }

  return NextResponse.json(ok(data))
}
