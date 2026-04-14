import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireManagementAccess, requireShopAccess } from '@/lib/auth/apiGuard'
import { err, ok } from '@/lib/utils'
import type { MenuItem } from '@/lib/types'

/**
 * GET /api/menu?shop_id=xxx[&available_only=true][&category_id=xxx]
 * Returns menu items with category join.
 * Requires: any shop member.
 */
export async function GET(req: NextRequest) {
  const shopId        = req.nextUrl.searchParams.get('shop_id')
  const availableOnly = req.nextUrl.searchParams.get('available_only') === 'true'
  const categoryId    = req.nextUrl.searchParams.get('category_id')
  const guard         = await requireShopAccess(shopId)
  if (!guard.ok) return guard.response

  const supabase = createServiceClient()

  let query = supabase
    .from('menu_items')
    .select('*, category:menu_categories (id, name, sort_order)')
    .eq('shop_id', shopId!)
    .order('sort_order', { ascending: true })

  if (availableOnly)  query = query.eq('is_available', true)
  if (categoryId)     query = query.eq('category_id', categoryId)

  const { data, error } = await query

  if (error) {
    console.error('[menu GET]', error)
    return NextResponse.json(err('DB_ERROR', 'Failed to fetch menu'), { status: 500 })
  }

  return NextResponse.json(ok<MenuItem[]>(data ?? []))
}

/**
 * POST /api/menu
 * Creates a new menu item.
 * Requires: owner or manager.
 *
 * Body: { shop_id, category_id, name, price, is_available?, sort_order? }
 */
export async function POST(req: NextRequest) {
  try {
    const body   = await req.json()
    const shopId = body?.shop_id as string | undefined
    const guard  = await requireManagementAccess(shopId)
    if (!guard.ok) return guard.response

    const { category_id, name, price, is_available = true, sort_order = 0 } = body

    if (!name || price === undefined) {
      return NextResponse.json(
        err('MISSING_FIELDS', 'name and price are required'),
        { status: 400 },
      )
    }

    if (typeof price !== 'number' || price < 0) {
      return NextResponse.json(
        err('INVALID_PRICE', 'price must be a non-negative integer'),
        { status: 400 },
      )
    }

    const supabase = createServiceClient()

    // If category_id provided, verify it belongs to this shop
    if (category_id) {
      const { count } = await supabase
        .from('menu_categories')
        .select('id', { count: 'exact', head: true })
        .eq('id', category_id)
        .eq('shop_id', shopId!)

      if (!count) {
        return NextResponse.json(
          err('INVALID_CATEGORY', 'Category not found in this shop'),
          { status: 422 },
        )
      }
    }

    const { data, error } = await supabase
      .from('menu_items')
      .insert({ shop_id: shopId, category_id: category_id ?? null, name, price, is_available, sort_order })
      .select('*, category:menu_categories (id, name, sort_order)')
      .single()

    if (error) {
      console.error('[menu POST]', error)
      return NextResponse.json(err('DB_ERROR', 'Failed to create menu item'), { status: 500 })
    }

    return NextResponse.json(ok<MenuItem>(data), { status: 201 })
  } catch (e) {
    console.error('[menu POST] unexpected:', e)
    return NextResponse.json(err('INTERNAL_ERROR', 'Internal server error'), { status: 500 })
  }
}
