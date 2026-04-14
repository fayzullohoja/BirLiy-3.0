import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/apiGuard'
import { verifyShopAccess } from '@/lib/auth/getUser'
import { err, ok } from '@/lib/utils'
import type { Order, OrderStatus, PaymentType } from '@/lib/types'

const VALID_STATUSES: OrderStatus[]   = ['open', 'in_kitchen', 'ready', 'paid', 'cancelled']
const VALID_PAYMENTS: PaymentType[]   = ['cash', 'card', 'payme', 'click']

/**
 * GET /api/orders/[id]
 * Returns a single order with full joins.
 * Requires: any shop member.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id }     = await params
    const authResult = await requireAuth()
    if (!authResult.ok) return authResult.response
    const { userId, role } = authResult.value

    const supabase = createServiceClient()

    const { data: order, error } = await supabase
      .from('orders')
      .select(`
        *,
        table:restaurant_tables (id, number, name, capacity, status),
        waiter:users (id, name, username),
        items:order_items (
          id, quantity, unit_price, status, notes, sent_to_kitchen_at, ready_at,
          menu_item:menu_items (id, name, price)
        )
      `)
      .eq('id', id)
      .single()

    if (error || !order) {
      return NextResponse.json(err('NOT_FOUND', 'Order not found'), { status: 404 })
    }

    const shopRole = await verifyShopAccess(userId, role, order.shop_id)
    if (!shopRole) {
      return NextResponse.json(err('FORBIDDEN', 'No access to this shop'), { status: 403 })
    }

    return NextResponse.json(ok<Order>(order))
  } catch (e) {
    console.error('[orders GET/:id] unexpected:', e)
    return NextResponse.json(err('INTERNAL_ERROR', 'Internal server error'), { status: 500 })
  }
}

/**
 * PATCH /api/orders/[id]
 *
 * Performs business actions on an active order.
 * - 'in_kitchen' sends only pending items to the kitchen.
 * - 'ready' marks the currently cooking batch as ready.
 * - 'paid' closes the full order only when no pending/in_kitchen items remain.
 * - 'cancelled' closes the order; waiters can only do this while every item is still pending.
 *
 * Body: { status: OrderStatus, payment_type?: PaymentType }
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

    const { status, payment_type }: { status: OrderStatus; payment_type?: PaymentType } = body

    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        err('INVALID_STATUS', `status must be one of: ${VALID_STATUSES.join(', ')}`),
        { status: 400 },
      )
    }

    if (payment_type && !VALID_PAYMENTS.includes(payment_type)) {
      return NextResponse.json(
        err('INVALID_PAYMENT_TYPE', `payment_type must be one of: ${VALID_PAYMENTS.join(', ')}`),
        { status: 400 },
      )
    }

    if (status === 'paid' && !payment_type) {
      return NextResponse.json(
        err('PAYMENT_TYPE_REQUIRED', 'payment_type is required when marking an order as paid'),
        { status: 400 },
      )
    }

    const supabase = createServiceClient()

    // Load current order to check authorization and current state
    const { data: order, error: fetchErr } = await supabase
      .from('orders')
      .select('id, shop_id, waiter_id, status')
      .eq('id', id)
      .single()

    if (fetchErr || !order) {
      return NextResponse.json(err('NOT_FOUND', 'Order not found'), { status: 404 })
    }

    // Verify shop membership
    const shopRole = await verifyShopAccess(userId, role, order.shop_id)
    if (!shopRole) {
      return NextResponse.json(err('FORBIDDEN', 'No access to this shop'), { status: 403 })
    }

    if (order.status === 'paid' || order.status === 'cancelled') {
      return NextResponse.json(
        err('ORDER_CLOSED', `Cannot change an order with status '${order.status}'`),
        { status: 422 },
      )
    }

    if (shopRole === 'waiter' && order.waiter_id !== userId) {
      return NextResponse.json(
        err('FORBIDDEN', 'Waiters can only update their own orders'),
        { status: 403 },
      )
    }

    const { data: itemRows, error: itemsErr } = await supabase
      .from('order_items')
      .select('id, status')
      .eq('order_id', id)

    if (itemsErr) {
      console.error('[orders PATCH] load items:', itemsErr)
      return NextResponse.json(err('DB_ERROR', 'Failed to inspect order items'), { status: 500 })
    }

    const items = itemRows ?? []
    const hasPending = items.some((item) => item.status === 'pending')
    const hasInKitchen = items.some((item) => item.status === 'in_kitchen')
    const hasReady = items.some((item) => item.status === 'ready')
    const allPending = items.length > 0 && items.every((item) => item.status === 'pending')

    if (status === 'open') {
      return NextResponse.json(
        err('INVALID_TRANSITION', 'Order status is recalculated automatically from item statuses'),
        { status: 422 },
      )
    }

    if (status === 'in_kitchen') {
      if (payment_type) {
        return NextResponse.json(
          err('FORBIDDEN', 'Payment type cannot be set when sending items to the kitchen'),
          { status: 403 },
        )
      }

      if (shopRole === 'kitchen') {
        return NextResponse.json(
          err('FORBIDDEN', 'Kitchen staff cannot send items to the kitchen queue'),
          { status: 403 },
        )
      }

      if (!hasPending) {
        return NextResponse.json(
          err('NO_PENDING_ITEMS', 'There are no new items left to send to the kitchen'),
          { status: 422 },
        )
      }

      const { error: sendErr } = await supabase
        .from('order_items')
        .update({
          status: 'in_kitchen',
          sent_to_kitchen_at: new Date().toISOString(),
          ready_at: null,
        })
        .eq('order_id', id)
        .eq('status', 'pending')

      if (sendErr) {
        console.error('[orders PATCH] send to kitchen:', sendErr)
        return NextResponse.json(
          err('DB_ERROR', sendErr.message ?? 'Failed to send pending items to the kitchen'),
          { status: 500 },
        )
      }

      const updated = await loadFullOrder(supabase, id)
      return NextResponse.json(ok<Order>(updated))
    }

    if (status === 'ready') {
      if (payment_type) {
        return NextResponse.json(
          err('FORBIDDEN', 'Payment type cannot be set when marking items ready'),
          { status: 403 },
        )
      }

      if (!['owner', 'kitchen'].includes(shopRole)) {
        return NextResponse.json(
          err('FORBIDDEN', 'Only kitchen staff or owners can mark kitchen items as ready'),
          { status: 403 },
        )
      }

      if (!hasInKitchen) {
        return NextResponse.json(
          err('NO_KITCHEN_ITEMS', 'There are no items currently on the kitchen queue'),
          { status: 422 },
        )
      }

      const { error: readyErr } = await supabase
        .from('order_items')
        .update({
          status: 'ready',
          ready_at: new Date().toISOString(),
        })
        .eq('order_id', id)
        .eq('status', 'in_kitchen')

      if (readyErr) {
        console.error('[orders PATCH] mark ready:', readyErr)
        return NextResponse.json(err('DB_ERROR', 'Failed to update kitchen items'), { status: 500 })
      }

      const updated = await loadFullOrder(supabase, id)
      return NextResponse.json(ok<Order>(updated))
    }

    if (status === 'paid') {
      if (!payment_type) {
        return NextResponse.json(
          err('PAYMENT_TYPE_REQUIRED', 'payment_type is required when marking an order as paid'),
          { status: 400 },
        )
      }

      if (shopRole === 'kitchen') {
        return NextResponse.json(
          err('FORBIDDEN', 'Kitchen staff cannot close orders'),
          { status: 403 },
        )
      }

      if (hasPending || hasInKitchen || !hasReady) {
        return NextResponse.json(
          err('ORDER_NOT_READY_FOR_PAYMENT', 'You can accept payment only after all items are cooked and no new items are pending'),
          { status: 422 },
        )
      }

      const { data: updated, error: updateErr } = await supabase
        .from('orders')
        .update({ status: 'paid', payment_type })
        .eq('id', id)
        .select()
        .single()

      if (updateErr || !updated) {
        console.error('[orders PATCH] pay order:', updateErr)
        return NextResponse.json(err('DB_ERROR', 'Failed to close the order'), { status: 500 })
      }

      return NextResponse.json(ok<Order>(updated))
    }

    if (status === 'cancelled') {
      if (payment_type) {
        return NextResponse.json(
          err('FORBIDDEN', 'Payment type cannot be set when cancelling an order'),
          { status: 403 },
        )
      }

      if (shopRole === 'kitchen') {
        return NextResponse.json(
          err('FORBIDDEN', 'Kitchen staff cannot cancel orders'),
          { status: 403 },
        )
      }

      if (shopRole === 'waiter' && !allPending) {
        return NextResponse.json(
          err('FORBIDDEN', 'Waiters can cancel an order only before any items are sent to the kitchen'),
          { status: 403 },
        )
      }

      const { data: updated, error: updateErr } = await supabase
        .from('orders')
        .update({ status: 'cancelled', payment_type: null })
        .eq('id', id)
        .select()
        .single()

      if (updateErr || !updated) {
        console.error('[orders PATCH] cancel order:', updateErr)
        return NextResponse.json(err('DB_ERROR', 'Failed to cancel the order'), { status: 500 })
      }

      return NextResponse.json(ok<Order>(updated))
    }

    return NextResponse.json(
      err('INVALID_TRANSITION', `Unsupported order action '${status}'`),
      { status: 422 },
    )
  } catch (e) {
    console.error('[orders PATCH] unexpected:', e)
    return NextResponse.json(err('INTERNAL_ERROR', 'Internal server error'), { status: 500 })
  }
}

async function loadFullOrder(
  supabase: ReturnType<typeof createServiceClient>,
  orderId: string,
) {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      table:restaurant_tables (id, number, name, capacity, status),
      waiter:users (id, name, username),
      items:order_items (
        *,
        menu_item:menu_items (id, name, price)
      )
    `)
    .eq('id', orderId)
    .single()

  if (error || !data) {
    throw error ?? new Error(`Order ${orderId} not found after update`)
  }

  return data as Order
}
