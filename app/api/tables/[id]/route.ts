import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth, requireManagementAccess } from '@/lib/auth/apiGuard'
import { verifyShopAccess } from '@/lib/auth/getUser'
import { err, ok } from '@/lib/utils'
import type { Table, TableStatus } from '@/lib/types'
import { isManagementShopRole } from '@/lib/roles'

const VALID_STATUSES: TableStatus[] = ['free', 'occupied', 'reserved', 'bill_requested']

/**
 * GET /api/tables/[id]
 * Returns a single table. Requires: any shop member.
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

    const { data: table, error } = await supabase
      .from('restaurant_tables')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !table) {
      return NextResponse.json(err('NOT_FOUND', 'Table not found'), { status: 404 })
    }

    const shopRole = await verifyShopAccess(userId, role, table.shop_id)
    if (!shopRole) {
      return NextResponse.json(err('FORBIDDEN', 'No access to this shop'), { status: 403 })
    }

    return NextResponse.json(ok<Table>(table))
  } catch (e) {
    console.error('[tables GET/:id] unexpected:', e)
    return NextResponse.json(err('INTERNAL_ERROR', 'Internal server error'), { status: 500 })
  }
}

/**
 * PATCH /api/tables/[id]
 * Updates table fields or status.
 * Requires: any shop member (for status changes); owner or manager (for structural changes).
 *
 * Body: Partial<{ name, capacity, status }>
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id }   = await params
    const authResult = await requireAuth()
    if (!authResult.ok) return authResult.response

    const body = await req.json()
    const { userId, role } = authResult.value

    // Fetch the table to know its shop_id
    const supabase = createServiceClient()
    const { data: table, error: fetchErr } = await supabase
      .from('restaurant_tables')
      .select('shop_id')
      .eq('id', id)
      .single()

    if (fetchErr || !table) {
      return NextResponse.json(err('NOT_FOUND', 'Table not found'), { status: 404 })
    }

    const shopRole = await verifyShopAccess(userId, role, table.shop_id)
    if (!shopRole) {
      return NextResponse.json(err('FORBIDDEN', 'No access to this shop'), { status: 403 })
    }

    if (shopRole === 'kitchen') {
      return NextResponse.json(
        err('FORBIDDEN', 'Kitchen staff cannot update tables'),
        { status: 403 },
      )
    }

    // Structural changes (name, capacity) require owner
    const isStructuralChange = 'name' in body || 'capacity' in body
    if (isStructuralChange && !isManagementShopRole(shopRole)) {
      return NextResponse.json(err('FORBIDDEN', 'Management access required to change table structure'), { status: 403 })
    }

    if (body.status && !VALID_STATUSES.includes(body.status)) {
      return NextResponse.json(
        err('INVALID_STATUS', `status must be one of: ${VALID_STATUSES.join(', ')}`),
        { status: 400 },
      )
    }

    const { data, error } = await supabase
      .from('restaurant_tables')
      .update(body)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[tables PATCH]', error)
      return NextResponse.json(err('DB_ERROR', 'Failed to update table'), { status: 500 })
    }

    return NextResponse.json(ok<Table>(data))
  } catch (e) {
    console.error('[tables PATCH] unexpected:', e)
    return NextResponse.json(err('INTERNAL_ERROR', 'Internal server error'), { status: 500 })
  }
}

/**
 * DELETE /api/tables/[id]
 * Deletes a table. Blocked if there are open orders.
 * Requires: owner or manager.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id }   = await params
    const supabase = createServiceClient()

    // Get table + shop_id
    const { data: table, error: fetchErr } = await supabase
      .from('restaurant_tables')
      .select('shop_id')
      .eq('id', id)
      .single()

    if (fetchErr || !table) {
      return NextResponse.json(err('NOT_FOUND', 'Table not found'), { status: 404 })
    }

    const guard = await requireManagementAccess(table.shop_id)
    if (!guard.ok) return guard.response

    // Guard: no active orders
    const { count } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('table_id', id)
      .not('status', 'in', '("paid","cancelled")')

    if (count && count > 0) {
      return NextResponse.json(
        err('HAS_OPEN_ORDERS', 'Cannot delete a table with active orders'),
        { status: 409 },
      )
    }

    const { error } = await supabase.from('restaurant_tables').delete().eq('id', id)
    if (error) {
      console.error('[tables DELETE]', error)
      return NextResponse.json(err('DB_ERROR', 'Failed to delete table'), { status: 500 })
    }

    return new NextResponse(null, { status: 204 })
  } catch (e) {
    console.error('[tables DELETE] unexpected:', e)
    return NextResponse.json(err('INTERNAL_ERROR', 'Internal server error'), { status: 500 })
  }
}
