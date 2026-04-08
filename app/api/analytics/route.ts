import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireShopAccess } from '@/lib/auth/apiGuard'
import { ok } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DayStats {
  date:    string   // YYYY-MM-DD
  revenue: number
  orders:  number
}

export interface WaiterStat {
  waiter_id:   string
  waiter_name: string
  orders:      number
  revenue:     number
}

export interface AnalyticsResponse {
  today: {
    revenue:    number
    orders:     number
    avg_order:  number
    open_orders: number
  }
  last7days:   DayStats[]
  waiters:     WaiterStat[]   // today's stats per waiter
}

/**
 * GET /api/analytics?shop_id=xxx
 *
 * Returns:
 *  - today's revenue, orders, avg order value, currently open orders
 *  - last 7 days daily breakdown (paid orders only)
 *  - today's per-waiter summary (paid orders only)
 *
 * Requires: owner.
 * All timestamps use Asia/Tashkent (UTC+5).
 */
export async function GET(req: NextRequest) {
  const shopId = req.nextUrl.searchParams.get('shop_id')
  const guard  = await requireShopAccess(shopId)
  if (!guard.ok) return guard.response

  const supabase = createServiceClient()

  // Compute today's date range in Tashkent time (UTC+5 = offset 300 min)
  const now          = new Date()
  const tzOffset     = 5 * 60 * 60 * 1000   // UTC+5
  const tashkentNow  = new Date(now.getTime() + tzOffset)
  const todayStr     = tashkentNow.toISOString().slice(0, 10)  // YYYY-MM-DD
  const todayStart   = new Date(`${todayStr}T00:00:00+05:00`).toISOString()
  const todayEnd     = new Date(`${todayStr}T23:59:59+05:00`).toISOString()

  const sevenDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000)
  sevenDaysAgo.setHours(0, 0, 0, 0)
  const sevenDaysAgoISO = new Date(sevenDaysAgo.getTime() - tzOffset).toISOString()

  // ── Paid orders today ──────────────────────────────────────────────────────
  const [paidTodayRes, openRes, last7Res] = await Promise.all([
    supabase
      .from('orders')
      .select('total_amount, waiter_id, waiter:users(id, name)')
      .eq('shop_id', shopId!)
      .eq('status', 'paid')
      .gte('updated_at', todayStart)
      .lte('updated_at', todayEnd),

    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', shopId!)
      .in('status', ['open', 'in_kitchen', 'ready']),

    supabase
      .from('orders')
      .select('total_amount, updated_at')
      .eq('shop_id', shopId!)
      .eq('status', 'paid')
      .gte('updated_at', sevenDaysAgoISO)
      .order('updated_at', { ascending: true }),
  ])

  // ── Today stats ────────────────────────────────────────────────────────────
  const paidToday    = paidTodayRes.data ?? []
  const todayRevenue = paidToday.reduce((s, o) => s + (o.total_amount ?? 0), 0)
  const todayOrders  = paidToday.length
  const todayAvg     = todayOrders > 0 ? Math.round(todayRevenue / todayOrders) : 0
  const openOrders   = openRes.count ?? 0

  // ── Waiter stats today ─────────────────────────────────────────────────────
  const waiterMap = new Map<string, WaiterStat>()
  for (const order of paidToday) {
    const wId   = order.waiter_id as string
    const wName = (order.waiter as unknown as { name?: string } | null)?.name ?? 'Неизвестно'
    const prev  = waiterMap.get(wId) ?? { waiter_id: wId, waiter_name: wName, orders: 0, revenue: 0 }
    waiterMap.set(wId, {
      ...prev,
      orders:  prev.orders + 1,
      revenue: prev.revenue + (order.total_amount ?? 0),
    })
  }
  const waiters = Array.from(waiterMap.values()).sort((a, b) => b.revenue - a.revenue)

  // ── Last 7 days ────────────────────────────────────────────────────────────
  const dayMap = new Map<string, DayStats>()

  // Initialise all 7 days with zeroes so days with no orders still appear
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() + tzOffset - i * 86400000)
    const key = d.toISOString().slice(0, 10)
    dayMap.set(key, { date: key, revenue: 0, orders: 0 })
  }

  for (const order of last7Res.data ?? []) {
    const orderTashkent = new Date(new Date(order.updated_at).getTime() + tzOffset)
    const key = orderTashkent.toISOString().slice(0, 10)
    const prev = dayMap.get(key)
    if (prev) {
      dayMap.set(key, {
        ...prev,
        orders:  prev.orders + 1,
        revenue: prev.revenue + (order.total_amount ?? 0),
      })
    }
  }

  const last7days = Array.from(dayMap.values()).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  )

  return NextResponse.json(
    ok<AnalyticsResponse>({
      today: {
        revenue:     todayRevenue,
        orders:      todayOrders,
        avg_order:   todayAvg,
        open_orders: openOrders,
      },
      last7days,
      waiters,
    }),
  )
}
