import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireShopAccess } from '@/lib/auth/apiGuard'
import { err, ok } from '@/lib/utils'
import type {
  ExtendedAnalyticsByDay,
  ExtendedAnalyticsByWaiter,
  ExtendedAnalyticsResponse,
  ExtendedAnalyticsTopItem,
} from '@/lib/types'

/**
 * GET /api/analytics/extended?shop_id=xxx&from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Returns extended paid-order analytics for a date range in Asia/Tashkent time.
 */
export async function GET(req: NextRequest) {
  const shopId = req.nextUrl.searchParams.get('shop_id')
  const from = req.nextUrl.searchParams.get('from')
  const to = req.nextUrl.searchParams.get('to')
  const guard = await requireShopAccess(shopId)
  if (!guard.ok) return guard.response

  if (!from || !to) {
    return NextResponse.json(err('MISSING_FIELDS', 'from and to are required'), { status: 400 })
  }

  const normalized = normalizeRange(from, to)
  if (!normalized) {
    return NextResponse.json(err('INVALID_RANGE', 'from/to must be valid YYYY-MM-DD dates'), { status: 400 })
  }

  const supabase = createServiceClient()
  const fromUTC = new Date(`${normalized.from}T00:00:00+05:00`).toISOString()
  const toUTC = new Date(`${normalized.to}T23:59:59+05:00`).toISOString()

  const { data: paidOrders, error: ordersErr } = await supabase
    .from('orders')
    .select(`
      id,
      total_amount,
      updated_at,
      waiter_id,
      waiter:users(id, name)
    `)
    .eq('shop_id', shopId!)
    .eq('status', 'paid')
    .gte('updated_at', fromUTC)
    .lte('updated_at', toUTC)
    .order('updated_at', { ascending: true })

  if (ordersErr) {
    console.error('[analytics extended] load orders:', ordersErr)
    return NextResponse.json(err('DB_ERROR', 'Failed to load analytics orders'), { status: 500 })
  }

  const orders = paidOrders ?? []
  const periodRevenue = orders.reduce((sum, order) => sum + (order.total_amount ?? 0), 0)
  const periodOrders = orders.length
  const avgOrder = periodOrders > 0 ? Math.round(periodRevenue / periodOrders) : 0

  const byDay = buildByDay(normalized.from, normalized.to, orders)
  const byWaiter = buildByWaiter(orders)

  let topItems: ExtendedAnalyticsTopItem[] = []
  if (orders.length > 0) {
    const orderIds = orders.map((order) => order.id)
    const { data: itemRows, error: itemsErr } = await supabase
      .from('order_items')
      .select(`
        menu_item_id,
        quantity,
        unit_price,
        menu_item:menu_items(id, name)
      `)
      .in('order_id', orderIds)

    if (itemsErr) {
      console.error('[analytics extended] load top items:', itemsErr)
      return NextResponse.json(err('DB_ERROR', 'Failed to load analytics items'), { status: 500 })
    }

    topItems = buildTopItems(itemRows ?? [])
  }

  return NextResponse.json(ok<ExtendedAnalyticsResponse>({
    period: {
      revenue: periodRevenue,
      orders: periodOrders,
      avg_order: avgOrder,
    },
    by_day: byDay,
    by_waiter: byWaiter,
    top_items: topItems,
  }))
}

function normalizeRange(from: string, to: string) {
  const fromDate = new Date(`${from}T00:00:00+05:00`)
  const toDate = new Date(`${to}T00:00:00+05:00`)
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) return null
  return from <= to ? { from, to } : { from: to, to: from }
}

function buildByDay(
  from: string,
  to: string,
  orders: Array<{ total_amount: number | null; updated_at: string }>,
): ExtendedAnalyticsByDay[] {
  const dayMap = new Map<string, ExtendedAnalyticsByDay>()
  const start = new Date(`${from}T00:00:00+05:00`)
  const end = new Date(`${to}T00:00:00+05:00`)

  for (let cursor = new Date(start); cursor <= end; cursor = new Date(cursor.getTime() + 86_400_000)) {
    const key = cursor.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tashkent' })
    dayMap.set(key, { date: key, revenue: 0, orders: 0 })
  }

  for (const order of orders) {
    const key = new Date(order.updated_at).toLocaleDateString('sv-SE', { timeZone: 'Asia/Tashkent' })
    const prev = dayMap.get(key)
    if (!prev) continue
    dayMap.set(key, {
      date: key,
      revenue: prev.revenue + (order.total_amount ?? 0),
      orders: prev.orders + 1,
    })
  }

  return Array.from(dayMap.values()).sort((left, right) => left.date.localeCompare(right.date))
}

function buildByWaiter(
  orders: Array<{
    waiter_id: string | null
    total_amount: number | null
    waiter: { id?: string; name?: string } | { id?: string; name?: string }[] | null
  }>,
): ExtendedAnalyticsByWaiter[] {
  const waiterMap = new Map<string, ExtendedAnalyticsByWaiter>()

  for (const order of orders) {
    const waiterId = order.waiter_id ?? 'unknown'
    const waiter = Array.isArray(order.waiter) ? order.waiter[0] : order.waiter
    const waiterName = waiter?.name ?? 'Неизвестно'
    const prev = waiterMap.get(waiterId) ?? {
      waiter_id: waiterId,
      waiter_name: waiterName,
      orders: 0,
      revenue: 0,
    }

    waiterMap.set(waiterId, {
      ...prev,
      orders: prev.orders + 1,
      revenue: prev.revenue + (order.total_amount ?? 0),
    })
  }

  return Array.from(waiterMap.values()).sort((left, right) => right.revenue - left.revenue)
}

function buildTopItems(
  rows: Array<{
    menu_item_id: string | null
    quantity: number
    unit_price: number
    menu_item: { id?: string; name?: string } | { id?: string; name?: string }[] | null
  }>,
): ExtendedAnalyticsTopItem[] {
  const itemMap = new Map<string, ExtendedAnalyticsTopItem>()

  for (const row of rows) {
    const menuItem = Array.isArray(row.menu_item) ? row.menu_item[0] : row.menu_item
    const itemId = row.menu_item_id ?? menuItem?.id ?? 'unknown'
    const itemName = menuItem?.name ?? 'Без названия'
    const prev = itemMap.get(itemId) ?? {
      item_id: itemId,
      name: itemName,
      quantity: 0,
      revenue: 0,
    }

    itemMap.set(itemId, {
      ...prev,
      quantity: prev.quantity + row.quantity,
      revenue: prev.revenue + row.quantity * row.unit_price,
    })
  }

  return Array.from(itemMap.values())
    .sort((left, right) => right.revenue - left.revenue)
    .slice(0, 10)
}
