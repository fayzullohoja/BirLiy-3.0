import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { err, ok } from '@/lib/utils'
import type { PublicReceiptOrder } from '@/lib/types'

/**
 * GET /api/public/receipt/[orderId]
 * Returns limited order data for receipt display — no auth required.
 * Only returns orders that are paid (not open/in-progress).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const { orderId } = await params

    if (!orderId || typeof orderId !== 'string') {
      return NextResponse.json(err('INVALID_PARAMS', 'orderId is required'), { status: 400 })
    }

    const supabase = createServiceClient()

    const { data: order, error } = await supabase
      .from('orders')
      .select(`
        id,
        shop_id,
        status,
        total_amount,
        payment_type,
        notes,
        created_at,
        updated_at,
        table_id,
        waiter_id,
        table:restaurant_tables (id, number, name, capacity),
        waiter:users (id, name),
        items:order_items (
          id,
          quantity,
          unit_price,
          status,
          notes,
          menu_item:menu_items (id, name)
        )
      `)
      .eq('id', orderId)
      .single()

    if (error || !order) {
      return NextResponse.json(err('NOT_FOUND', 'Receipt not found'), { status: 404 })
    }

    const receipt: PublicReceiptOrder = {
      id:           order.id,
      table_id:     order.table_id,
      status:       order.status,
      total_amount: order.total_amount,
      payment_type: order.payment_type,
      notes:        order.notes,
      created_at:   order.created_at,
      updated_at:   order.updated_at,
      table:        Array.isArray(order.table) ? (order.table[0] ?? null) : (order.table ?? null),
      waiter:       Array.isArray(order.waiter) ? (order.waiter[0] ?? null) : (order.waiter ?? null),
      items:        (order.items ?? []).map((item) => ({
        id:         item.id,
        quantity:   item.quantity,
        unit_price: item.unit_price,
        status:     item.status,
        notes:      item.notes,
        menu_item:  Array.isArray(item.menu_item) ? (item.menu_item[0] ?? null) : (item.menu_item ?? null),
      })),
    }

    return NextResponse.json(ok<PublicReceiptOrder>(receipt))
  } catch (e) {
    console.error('[public/receipt GET] unexpected:', e)
    return NextResponse.json(err('INTERNAL_ERROR', 'Internal server error'), { status: 500 })
  }
}
