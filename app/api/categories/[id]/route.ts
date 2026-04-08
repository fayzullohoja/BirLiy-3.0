import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireOwnerAccess } from '@/lib/auth/apiGuard'
import { err, ok } from '@/lib/utils'
import type { MenuCategory } from '@/lib/types'

/**
 * PATCH /api/categories/[id]
 * Updates a category name or sort_order.
 * Requires: owner.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id }   = await params
    const body     = await req.json()
    const supabase = createServiceClient()

    const { data: cat } = await supabase
      .from('menu_categories')
      .select('shop_id')
      .eq('id', id)
      .single()

    if (!cat) {
      return NextResponse.json(err('NOT_FOUND', 'Category not found'), { status: 404 })
    }

    const guard = await requireOwnerAccess(cat.shop_id)
    if (!guard.ok) return guard.response

    const updates: Record<string, unknown> = {}
    if (body.name       !== undefined) updates.name       = String(body.name).trim()
    if (body.sort_order !== undefined) updates.sort_order = body.sort_order

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(err('MISSING_FIELDS', 'Nothing to update'), { status: 400 })
    }

    const { data, error } = await supabase
      .from('menu_categories')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[categories PATCH]', error)
      return NextResponse.json(err('DB_ERROR', 'Failed to update category'), { status: 500 })
    }

    return NextResponse.json(ok<MenuCategory>(data))
  } catch (e) {
    console.error('[categories PATCH] unexpected:', e)
    return NextResponse.json(err('INTERNAL_ERROR', 'Internal server error'), { status: 500 })
  }
}

/**
 * DELETE /api/categories/[id]
 * Removes a category.
 * Items in this category are set to category_id = NULL (not deleted).
 * Requires: owner.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id }   = await params
    const supabase = createServiceClient()

    const { data: cat } = await supabase
      .from('menu_categories')
      .select('shop_id')
      .eq('id', id)
      .single()

    if (!cat) {
      return NextResponse.json(err('NOT_FOUND', 'Category not found'), { status: 404 })
    }

    const guard = await requireOwnerAccess(cat.shop_id)
    if (!guard.ok) return guard.response

    // Unlink items before deleting (FK is nullable, so set to NULL)
    await supabase
      .from('menu_items')
      .update({ category_id: null })
      .eq('category_id', id)

    const { error } = await supabase
      .from('menu_categories')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[categories DELETE]', error)
      return NextResponse.json(err('DB_ERROR', 'Failed to delete category'), { status: 500 })
    }

    return new NextResponse(null, { status: 204 })
  } catch (e) {
    console.error('[categories DELETE] unexpected:', e)
    return NextResponse.json(err('INTERNAL_ERROR', 'Internal server error'), { status: 500 })
  }
}
