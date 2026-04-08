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
          id, quantity, unit_price, notes,
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

/** Allowed status transitions */
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  open:       ['in_kitchen', 'paid', 'cancelled'],
  in_kitchen: ['ready', 'paid', 'cancelled'],
  ready:      ['paid', 'cancelled'],
  paid:       [],
  cancelled:  [],
}

/**
 * PATCH /api/orders/[id]
 *
 * Transitions order status and optionally sets payment_type.
 * - Validates allowed status transitions.
 * - DB trigger handles table status sync automatically.
 * - Waiters can only update their own orders; owners can update any.
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

    // Load current order to check transition + authorization
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

    // Waiters can only transition their own orders
    if (shopRole === 'waiter' && order.waiter_id !== userId) {
      return NextResponse.json(
        err('FORBIDDEN', 'Waiters can only update their own orders'),
        { status: 403 },
      )
    }

    // Validate status transition
    const currentStatus = order.status as OrderStatus
    const allowed       = TRANSITIONS[currentStatus]
    if (!allowed.includes(status)) {
      return NextResponse.json(
        err(
          'INVALID_TRANSITION',
          `Cannot transition from '${currentStatus}' to '${status}'. Allowed: ${allowed.join(', ') || 'none'}`,
        ),
        { status: 422 },
      )
    }

    // Perform update; DB trigger handles table status sync
    const updates: Record<string, unknown> = { status }
    if (payment_type)            updates.payment_type = payment_type
    if (status === 'cancelled')  updates.payment_type = null

    const { data: updated, error: updateErr } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (updateErr) {
      console.error('[orders PATCH]', updateErr)
      return NextResponse.json(err('DB_ERROR', 'Failed to update order'), { status: 500 })
    }

    return NextResponse.json(ok<Order>(updated))
  } catch (e) {
    console.error('[orders PATCH] unexpected:', e)
    return NextResponse.json(err('INTERNAL_ERROR', 'Internal server error'), { status: 500 })
  }
}
