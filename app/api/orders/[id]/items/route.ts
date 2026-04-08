import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/apiGuard'
import { verifyShopAccess } from '@/lib/auth/getUser'
import { err, ok } from '@/lib/utils'
import type { Order } from '@/lib/types'

/**
 * POST /api/orders/[id]/items
 *
 * Adds one or more items to an existing order.
 * Order must be 'open' or 'in_kitchen'.
 * Prices are always taken from the DB (menu_items.price), not the client.
 *
 * Body: { items: Array<{ menu_item_id: string; quantity: number; notes?: string }> }
 *
 * Returns: updated Order with items joined.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id }     = await params
    const authResult = await requireAuth()
    if (!authResult.ok) return authResult.response

    const { userId, role } = authResult.value
    const body = await req.json()

    const items: Array<{ menu_item_id: string; quantity: number; notes?: string }> =
      body?.items

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        err('MISSING_ITEMS', 'items array is required and must not be empty'),
        { status: 400 },
      )
    }

    for (const item of items) {
      if (!item.menu_item_id || typeof item.menu_item_id !== 'string') {
        return NextResponse.json(
          err('INVALID_ITEM', 'Each item must have a valid menu_item_id'),
          { status: 400 },
        )
      }
      if (!Number.isInteger(item.quantity) || item.quantity < 1) {
        return NextResponse.json(
          err('INVALID_QUANTITY', 'quantity must be a positive integer'),
          { status: 400 },
        )
      }
    }

    const supabase = createServiceClient()

    // Fetch order to verify it exists and is in an editable state
    const { data: order, error: fetchErr } = await supabase
      .from('orders')
      .select('id, shop_id, waiter_id, status')
      .eq('id', id)
      .single()

    if (fetchErr || !order) {
      return NextResponse.json(err('NOT_FOUND', 'Order not found'), { status: 404 })
    }

    if (!['open', 'in_kitchen'].includes(order.status)) {
      return NextResponse.json(
        err('ORDER_NOT_EDITABLE', `Cannot add items to an order with status '${order.status}'`),
        { status: 422 },
      )
    }

    // Verify shop membership
    const shopRole = await verifyShopAccess(userId, role, order.shop_id)
    if (!shopRole) {
      return NextResponse.json(err('FORBIDDEN', 'No access to this shop'), { status: 403 })
    }

    // Waiters can only modify their own orders
    if (shopRole === 'waiter' && order.waiter_id !== userId) {
      return NextResponse.json(
        err('FORBIDDEN', 'Waiters can only modify their own orders'),
        { status: 403 },
      )
    }

    // Verify all menu items belong to this shop and fetch prices
    const menuItemIds = items.map(i => i.menu_item_id)
    const { data: menuItems, error: menuErr } = await supabase
      .from('menu_items')
      .select('id, price, is_available, shop_id')
      .in('id', menuItemIds)

    if (menuErr) {
      return NextResponse.json(err('DB_ERROR', 'Failed to fetch menu items'), { status: 500 })
    }

    if (!menuItems || menuItems.length !== menuItemIds.length) {
      return NextResponse.json(
        err('INVALID_ITEM', 'One or more menu items not found'),
        { status: 422 },
      )
    }

    for (const mi of menuItems) {
      if (mi.shop_id !== order.shop_id) {
        return NextResponse.json(
          err('INVALID_ITEM', 'Menu item does not belong to this shop'),
          { status: 422 },
        )
      }
      if (!mi.is_available) {
        return NextResponse.json(
          err('ITEM_UNAVAILABLE', `Menu item "${mi.id}" is not available`),
          { status: 422 },
        )
      }
    }

    // Build price map
    const priceMap = new Map(menuItems.map(mi => [mi.id, mi.price]))

    // Insert order items; DB trigger recalculates order total automatically
    const insertRows = items.map(item => ({
      order_id:     id,
      menu_item_id: item.menu_item_id,
      quantity:     item.quantity,
      unit_price:   priceMap.get(item.menu_item_id)!,
      notes:        item.notes ?? null,
    }))

    const { error: insertErr } = await supabase
      .from('order_items')
      .insert(insertRows)

    if (insertErr) {
      console.error('[orders/items POST]', insertErr)
      return NextResponse.json(err('DB_ERROR', 'Failed to insert order items'), { status: 500 })
    }

    // Return the updated order with all items
    const { data: updatedOrder, error: refetchErr } = await supabase
      .from('orders')
      .select(`
        *,
        table:restaurant_tables (id, number, name),
        waiter:users (id, name),
        items:order_items (
          *,
          menu_item:menu_items (id, name, price)
        )
      `)
      .eq('id', id)
      .single()

    if (refetchErr || !updatedOrder) {
      return NextResponse.json(err('DB_ERROR', 'Failed to fetch updated order'), { status: 500 })
    }

    return NextResponse.json(ok<Order>(updatedOrder), { status: 201 })
  } catch (e) {
    console.error('[orders/items POST] unexpected:', e)
    return NextResponse.json(err('INTERNAL_ERROR', 'Internal server error'), { status: 500 })
  }
}
