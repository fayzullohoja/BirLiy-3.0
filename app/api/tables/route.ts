import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireManagementAccess, requireShopAccess } from '@/lib/auth/apiGuard'
import { err, ok } from '@/lib/utils'
import type { Table } from '@/lib/types'

/**
 * GET /api/tables?shop_id=xxx
 * Returns all tables for the shop, ordered by number.
 * Requires: any shop member.
 */
export async function GET(req: NextRequest) {
  const shopId = req.nextUrl.searchParams.get('shop_id')
  const guard  = await requireShopAccess(shopId)
  if (!guard.ok) return guard.response

  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('restaurant_tables')
    .select('*')
    .eq('shop_id', shopId!)
    .order('number', { ascending: true })

  if (error) {
    console.error('[tables GET]', error)
    return NextResponse.json(err('DB_ERROR', 'Failed to fetch tables'), { status: 500 })
  }

  return NextResponse.json(ok<Table[]>(data ?? []))
}

/**
 * POST /api/tables
 * Creates a new table.
 * Requires: owner or manager.
 *
 * Body: { shop_id, number, name, capacity? }
 */
export async function POST(req: NextRequest) {
  try {
    const body   = await req.json()
    const shopId = body?.shop_id as string | undefined
    const guard  = await requireManagementAccess(shopId)
    if (!guard.ok) return guard.response

    const { number, name, capacity = 4 } = body

    if (!number || !name) {
      return NextResponse.json(
        err('MISSING_FIELDS', 'number and name are required'),
        { status: 400 },
      )
    }

    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('restaurant_tables')
      .insert({ shop_id: shopId, number, name, capacity })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          err('DUPLICATE_NUMBER', `Table number ${number} already exists in this shop`),
          { status: 409 },
        )
      }
      console.error('[tables POST]', error)
      return NextResponse.json(err('DB_ERROR', 'Failed to create table'), { status: 500 })
    }

    return NextResponse.json(ok<Table>(data), { status: 201 })
  } catch (e) {
    console.error('[tables POST] unexpected:', e)
    return NextResponse.json(err('INTERNAL_ERROR', 'Internal server error'), { status: 500 })
  }
}
