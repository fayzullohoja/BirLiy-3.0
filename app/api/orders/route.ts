import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireShopAccess } from '@/lib/auth/apiGuard'
import { err, ok } from '@/lib/utils'
import type { Order, OrderStatus } from '@/lib/types'

/**
 * GET /api/orders?shop_id=xxx[&status=open,in_kitchen][&table_id=xxx]
 *
 * Returns orders for the shop with full joins.
 * Waiters get all orders for their shop; scope is enforced by shop membership.
 * Requires: any shop member.
 */
export async function GET(req: NextRequest) {
  const shopId   = req.nextUrl.searchParams.get('shop_id')
  const statusP  = req.nextUrl.searchParams.get('status')
  const tableId  = req.nextUrl.searchParams.get('table_id')
  const dateStr  = req.nextUrl.searchParams.get('date')   // YYYY-MM-DD in Tashkent
  const guard    = await requireShopAccess(shopId)
  if (!guard.ok) return guard.response

  const supabase = createServiceClient()

  let query = supabase
    .from('orders')
    .select(`
      *,
      table:restaurant_tables (id, name, number, status),
      waiter:users         (id, name, username),
      items:order_items    (
        id, quantity, unit_price, status, notes, sent_to_kitchen_at, ready_at,
        menu_item:menu_items (id, name, price)
      )
    `)
    .eq('shop_id', shopId!)
    .order('created_at', { ascending: false })

  if (statusP) {
    const statuses = statusP.split(',').map((s) => s.trim())
    query = query.in('status', statuses)
  }

  if (tableId) {
    query = query.eq('table_id', tableId)
  }

  // Filter by calendar date (Tashkent UTC+5)
  if (dateStr) {
    const dayStart = new Date(`${dateStr}T00:00:00+05:00`).toISOString()
    const dayEnd   = new Date(`${dateStr}T23:59:59+05:00`).toISOString()
    query = query.gte('created_at', dayStart).lte('created_at', dayEnd)
  }

  const { data, error } = await query

  if (error) {
    console.error('[orders GET]', error)
    return NextResponse.json(err('DB_ERROR', 'Failed to fetch orders'), { status: 500 })
  }

  return NextResponse.json(ok<Order[]>(data ?? []))
}

/**
 * POST /api/orders
 *
 * Creates a new order with items.
 * - Prices are always read from the DB (not trusted from the client).
 * - Unavailable items are rejected with 422.
 * - The DB trigger handles table status → 'occupied'.
 * - The DB unique index enforces one active order per table.
 *
 * Requires: owner or waiter (waiter_id is set to the caller).
 *
 * Body: { shop_id, table_id, items: [{ menu_item_id, quantity, notes? }], notes? }
 */
export async function POST(req: NextRequest) {
  try {
    const body   = await req.json()
    const shopId = body?.shop_id as string | undefined
    const guard  = await requireShopAccess(shopId)
    if (!guard.ok) return guard.response

    const { userId, shopRole } = guard.value
    if (shopRole === 'kitchen') {
      return NextResponse.json(
        err('FORBIDDEN', 'Kitchen staff cannot create orders'),
        { status: 403 },
      )
    }

    const { table_id, items, notes } = body

    if (!table_id || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        err('MISSING_FIELDS', 'table_id and items[] are required'),
        { status: 400 },
      )
    }

    const supabase = createServiceClient()

    // 1. Verify table belongs to this shop
    const { data: table } = await supabase
      .from('restaurant_tables')
      .select('id, status, shop_id')
      .eq('id', table_id)
      .eq('shop_id', shopId!)
      .single()

    if (!table) {
      return NextResponse.json(err('NOT_FOUND', 'Table not found in this shop'), { status: 404 })
    }

    // 2. Fetch and validate menu items (prices from DB, not client)
    const menuItemIds = items.map((i: { menu_item_id: string }) => i.menu_item_id)
    const { data: menuItems, error: menuErr } = await supabase
      .from('menu_items')
      .select('id, price, is_available, name')
      .in('id', menuItemIds)
      .eq('shop_id', shopId!)  // extra safety: ensure items belong to this shop

    if (menuErr || !menuItems) {
      return NextResponse.json(err('DB_ERROR', 'Failed to load menu items'), { status: 500 })
    }

    if (menuItems.length !== menuItemIds.length) {
      return NextResponse.json(
        err('ITEM_NOT_FOUND', 'One or more menu items not found in this shop'),
        { status: 422 },
      )
    }

    const unavailable = menuItems.filter((m) => !m.is_available)
    if (unavailable.length > 0) {
      return NextResponse.json(
        err('ITEM_UNAVAILABLE', `Not available: ${unavailable.map((m) => m.name).join(', ')}`),
        { status: 422 },
      )
    }

    const priceMap: Record<string, number> = Object.fromEntries(
      menuItems.map((m) => [m.id, m.price]),
    )

    // 3. Create order (total_amount is recomputed by DB trigger from order_items)
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert({
        shop_id:   shopId,
        table_id,
        waiter_id: userId,
        status:    'open' satisfies OrderStatus,
        notes:     notes ?? null,
      })
      .select()
      .single()

    if (orderErr) {
      if (orderErr.code === '23505') {
        // unique index: orders_one_active_per_table
        return NextResponse.json(
          err('TABLE_BUSY', 'This table already has an active order'),
          { status: 409 },
        )
      }
      console.error('[orders POST] insert order:', orderErr)
      return NextResponse.json(err('DB_ERROR', 'Failed to create order'), { status: 500 })
    }

    // 4. Insert order items (DB trigger recalculates total_amount)
    const orderItems = items.map((item: { menu_item_id: string; quantity: number; notes?: string }) => ({
      order_id:     order.id,
      menu_item_id: item.menu_item_id,
      quantity:     item.quantity,
      unit_price:   priceMap[item.menu_item_id],
      status:       'pending' as const,
      notes:        item.notes ?? null,
    }))

    const { error: itemsErr } = await supabase.from('order_items').insert(orderItems)

    if (itemsErr) {
      console.error('[orders POST] insert items:', itemsErr)
      // Order was created without items — attempt cleanup
      await supabase.from('orders').delete().eq('id', order.id)
      return NextResponse.json(err('DB_ERROR', 'Failed to add order items'), { status: 500 })
    }

    // 5. Fetch the complete order with all joins to return
    const { data: fullOrder } = await supabase
      .from('orders')
      .select(`
        *,
        table:restaurant_tables (id, name, number, status),
        waiter:users (id, name),
        items:order_items (
          id, quantity, unit_price, status, notes, sent_to_kitchen_at, ready_at,
          menu_item:menu_items (id, name, price)
        )
      `)
      .eq('id', order.id)
      .single()

    return NextResponse.json(ok<Order>(fullOrder ?? order), { status: 201 })
  } catch (e) {
    console.error('[orders POST] unexpected:', e)
    return NextResponse.json(err('INTERNAL_ERROR', 'Internal server error'), { status: 500 })
  }
}
