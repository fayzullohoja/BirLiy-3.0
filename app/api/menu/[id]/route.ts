import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireOwnerAccess } from '@/lib/auth/apiGuard'
import { err, ok } from '@/lib/utils'
import type { MenuItem } from '@/lib/types'

/**
 * PATCH /api/menu/[id]
 * Partial update of a menu item.
 * Requires: owner of the item's shop.
 *
 * Body: Partial<{ name, price, is_available, sort_order, category_id }>
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id }   = await params
    const body     = await req.json()
    const supabase = createServiceClient()

    // Fetch item to get shop_id for auth check
    const { data: item } = await supabase
      .from('menu_items')
      .select('shop_id')
      .eq('id', id)
      .single()

    if (!item) {
      return NextResponse.json(err('NOT_FOUND', 'Menu item not found'), { status: 404 })
    }

    const guard = await requireOwnerAccess(item.shop_id)
    if (!guard.ok) return guard.response

    if (body.price !== undefined && (typeof body.price !== 'number' || body.price < 0)) {
      return NextResponse.json(
        err('INVALID_PRICE', 'price must be a non-negative integer'),
        { status: 400 },
      )
    }

    // Prevent shop_id tampering
    const safeBody = { ...body }
    delete safeBody.shop_id

    const { data, error } = await supabase
      .from('menu_items')
      .update(safeBody)
      .eq('id', id)
      .select('*, category:menu_categories (id, name, sort_order)')
      .single()

    if (error) {
      console.error('[menu PATCH]', error)
      return NextResponse.json(err('DB_ERROR', 'Failed to update menu item'), { status: 500 })
    }

    return NextResponse.json(ok<MenuItem>(data))
  } catch (e) {
    console.error('[menu PATCH] unexpected:', e)
    return NextResponse.json(err('INTERNAL_ERROR', 'Internal server error'), { status: 500 })
  }
}

/**
 * DELETE /api/menu/[id]
 * Removes a menu item.
 * Requires: owner. Blocked if item is referenced by open orders.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id }   = await params
    const supabase = createServiceClient()

    const { data: item } = await supabase
      .from('menu_items')
      .select('shop_id')
      .eq('id', id)
      .single()

    if (!item) {
      return NextResponse.json(err('NOT_FOUND', 'Menu item not found'), { status: 404 })
    }

    const guard = await requireOwnerAccess(item.shop_id)
    if (!guard.ok) return guard.response

    // Guard: referenced by open order items?
    const { count } = await supabase
      .from('order_items')
      .select('id', { count: 'exact', head: true })
      .eq('menu_item_id', id)

    if (count && count > 0) {
      // Soft-delete preferred: mark unavailable instead
      await supabase.from('menu_items').update({ is_available: false }).eq('id', id)
      return NextResponse.json(
        ok({ soft_deleted: true, message: 'Item marked unavailable (has order history)' }),
      )
    }

    const { error } = await supabase.from('menu_items').delete().eq('id', id)
    if (error) {
      console.error('[menu DELETE]', error)
      return NextResponse.json(err('DB_ERROR', 'Failed to delete menu item'), { status: 500 })
    }

    return new NextResponse(null, { status: 204 })
  } catch (e) {
    console.error('[menu DELETE] unexpected:', e)
    return NextResponse.json(err('INTERNAL_ERROR', 'Internal server error'), { status: 500 })
  }
}
