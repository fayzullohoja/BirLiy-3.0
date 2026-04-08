import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/apiGuard'
import { verifyShopAccess } from '@/lib/auth/getUser'
import { err, ok } from '@/lib/utils'
import type { Order } from '@/lib/types'

/**
 * PATCH /api/order-items/[id]
 *
 * Updates quantity (and optionally notes) of an existing order item.
 * Order must be 'open' or 'in_kitchen'.
 * DB trigger recalculates order total automatically.
 *
 * Body: { quantity: number; notes?: string }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id }     = await params
    const authResult = await requireAuth()
    if (!authResult.ok) return authResult.response

    const { userId, role } = authResult.value
    const body = await req.json()

    if (body.quantity !== undefined) {
      if (!Number.isInteger(body.quantity) || body.quantity < 1) {
        return NextResponse.json(
          err('INVALID_QUANTITY', 'quantity must be a positive integer'),
          { status: 400 },
        )
      }
    }

    const supabase = createServiceClient()

    // Fetch the order item with its parent order
    const { data: orderItem, error: fetchErr } = await supabase
      .from('order_items')
      .select('id, order_id, order:orders(id, shop_id, waiter_id, status)')
      .eq('id', id)
      .single()

    if (fetchErr || !orderItem) {
      return NextResponse.json(err('NOT_FOUND', 'Order item not found'), { status: 404 })
    }

    const order = orderItem.order as unknown as {
      id: string; shop_id: string; waiter_id: string; status: string
    }

    if (!['open', 'in_kitchen'].includes(order.status)) {
      return NextResponse.json(
        err('ORDER_NOT_EDITABLE', `Cannot modify items on an order with status '${order.status}'`),
        { status: 422 },
      )
    }

    const shopRole = await verifyShopAccess(userId, role, order.shop_id)
    if (!shopRole) {
      return NextResponse.json(err('FORBIDDEN', 'No access to this shop'), { status: 403 })
    }

    if (shopRole === 'kitchen') {
      return NextResponse.json(
        err('FORBIDDEN', 'Kitchen staff cannot modify order items'),
        { status: 403 },
      )
    }

    if (shopRole === 'waiter' && order.waiter_id !== userId) {
      return NextResponse.json(
        err('FORBIDDEN', 'Waiters can only modify their own orders'),
        { status: 403 },
      )
    }

    const updates: Record<string, unknown> = {}
    if (body.quantity !== undefined) updates.quantity = body.quantity
    if (body.notes    !== undefined) updates.notes    = body.notes ?? null

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        err('MISSING_FIELDS', 'Nothing to update'),
        { status: 400 },
      )
    }

    const { error: updateErr } = await supabase
      .from('order_items')
      .update(updates)
      .eq('id', id)

    if (updateErr) {
      console.error('[order-items PATCH]', updateErr)
      return NextResponse.json(err('DB_ERROR', 'Failed to update order item'), { status: 500 })
    }

    // Return updated parent order
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
      .eq('id', order.id)
      .single()

    if (refetchErr || !updatedOrder) {
      return NextResponse.json(err('DB_ERROR', 'Failed to fetch updated order'), { status: 500 })
    }

    return NextResponse.json(ok<Order>(updatedOrder))
  } catch (e) {
    console.error('[order-items PATCH] unexpected:', e)
    return NextResponse.json(err('INTERNAL_ERROR', 'Internal server error'), { status: 500 })
  }
}

/**
 * DELETE /api/order-items/[id]
 *
 * Removes an item from an order.
 * Order must be 'open' or 'in_kitchen'.
 * DB trigger recalculates order total automatically.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id }     = await params
    const authResult = await requireAuth()
    if (!authResult.ok) return authResult.response

    const { userId, role } = authResult.value
    const supabase = createServiceClient()

    const { data: orderItem, error: fetchErr } = await supabase
      .from('order_items')
      .select('id, order_id, order:orders(id, shop_id, waiter_id, status)')
      .eq('id', id)
      .single()

    if (fetchErr || !orderItem) {
      return NextResponse.json(err('NOT_FOUND', 'Order item not found'), { status: 404 })
    }

    const order = orderItem.order as unknown as {
      id: string; shop_id: string; waiter_id: string; status: string
    }

    if (!['open', 'in_kitchen'].includes(order.status)) {
      return NextResponse.json(
        err('ORDER_NOT_EDITABLE', `Cannot remove items from an order with status '${order.status}'`),
        { status: 422 },
      )
    }

    const shopRole = await verifyShopAccess(userId, role, order.shop_id)
    if (!shopRole) {
      return NextResponse.json(err('FORBIDDEN', 'No access to this shop'), { status: 403 })
    }

    if (shopRole === 'kitchen') {
      return NextResponse.json(
        err('FORBIDDEN', 'Kitchen staff cannot modify order items'),
        { status: 403 },
      )
    }

    if (shopRole === 'waiter' && order.waiter_id !== userId) {
      return NextResponse.json(
        err('FORBIDDEN', 'Waiters can only modify their own orders'),
        { status: 403 },
      )
    }

    const { error: deleteErr } = await supabase
      .from('order_items')
      .delete()
      .eq('id', id)

    if (deleteErr) {
      console.error('[order-items DELETE]', deleteErr)
      return NextResponse.json(err('DB_ERROR', 'Failed to delete order item'), { status: 500 })
    }

    return new NextResponse(null, { status: 204 })
  } catch (e) {
    console.error('[order-items DELETE] unexpected:', e)
    return NextResponse.json(err('INTERNAL_ERROR', 'Internal server error'), { status: 500 })
  }
}
