import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/auth/apiGuard'
import { ok } from '@/lib/utils'

/**
 * GET /api/admin/stats
 * Platform-level overview: shop count, user count, subscription breakdown,
 * today's total orders (across all shops). Requires: super_admin.
 */
export async function GET() {
  const guard = await requireSuperAdmin()
  if (!guard.ok) return guard.response

  const supabase = createServiceClient()

  // Tashkent is UTC+5 — compute today's bounds
  const nowUtc   = new Date()
  const tzOffset = 5 * 60 * 60 * 1000
  const todayTZ  = new Date(nowUtc.getTime() + tzOffset)
  const todayStr = todayTZ.toISOString().slice(0, 10)
  const todayStart = new Date(`${todayStr}T00:00:00+05:00`).toISOString()
  const todayEnd   = new Date(`${todayStr}T23:59:59+05:00`).toISOString()

  const [
    { count: shopCount },
    { count: userCount },
    { data: subRows },
    { count: todayOrders },
  ] = await Promise.all([
    supabase.from('shops').select('*', { count: 'exact', head: true }),
    supabase.from('users').select('*', { count: 'exact', head: true }),
    supabase.from('subscriptions').select('status'),
    supabase.from('orders')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayStart)
      .lte('created_at', todayEnd),
  ])

  const subBreakdown = { trial: 0, active: 0, expired: 0, suspended: 0 }
  for (const row of subRows ?? []) {
    subBreakdown[row.status as keyof typeof subBreakdown] =
      (subBreakdown[row.status as keyof typeof subBreakdown] ?? 0) + 1
  }

  return NextResponse.json(ok({
    shops:         shopCount ?? 0,
    users:         userCount ?? 0,
    subscriptions: subBreakdown,
    today_orders:  todayOrders ?? 0,
  }))
}
