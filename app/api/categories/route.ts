import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireManagementAccess, requireShopAccess } from '@/lib/auth/apiGuard'
import { err, ok } from '@/lib/utils'
import type { MenuCategory } from '@/lib/types'

/**
 * GET /api/categories?shop_id=xxx
 * Returns all menu categories for the shop ordered by sort_order.
 * Requires: any shop member.
 */
export async function GET(req: NextRequest) {
  const shopId = req.nextUrl.searchParams.get('shop_id')
  const guard  = await requireShopAccess(shopId)
  if (!guard.ok) return guard.response

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('menu_categories')
    .select('*')
    .eq('shop_id', shopId!)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('[categories GET]', error)
    return NextResponse.json(err('DB_ERROR', 'Failed to fetch categories'), { status: 500 })
  }

  return NextResponse.json(ok<MenuCategory[]>(data ?? []))
}

/**
 * POST /api/categories
 * Creates a new menu category.
 * Requires: owner or manager.
 *
 * Body: { shop_id, name, sort_order? }
 */
export async function POST(req: NextRequest) {
  try {
    const body   = await req.json()
    const shopId = body?.shop_id as string | undefined
    const guard  = await requireManagementAccess(shopId)
    if (!guard.ok) return guard.response

    const { name, sort_order = 0 } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        err('MISSING_FIELDS', 'name is required'),
        { status: 400 },
      )
    }

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('menu_categories')
      .insert({ shop_id: shopId, name: name.trim(), sort_order })
      .select()
      .single()

    if (error) {
      console.error('[categories POST]', error)
      return NextResponse.json(err('DB_ERROR', 'Failed to create category'), { status: 500 })
    }

    return NextResponse.json(ok<MenuCategory>(data), { status: 201 })
  } catch (e) {
    console.error('[categories POST] unexpected:', e)
    return NextResponse.json(err('INTERNAL_ERROR', 'Internal server error'), { status: 500 })
  }
}
