import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireOwnerAccess, requireShopAccess } from '@/lib/auth/apiGuard'
import { err, ok } from '@/lib/utils'
import type { TableBooking } from '@/lib/types'

/**
 * GET /api/bookings?shop_id=xxx[&date=YYYY-MM-DD][&status=confirmed,seated]
 *
 * Returns bookings for the shop with table join, ordered by booked_at asc.
 * Requires: any shop member.
 */
export async function GET(req: NextRequest) {
  const shopId  = req.nextUrl.searchParams.get('shop_id')
  const dateStr = req.nextUrl.searchParams.get('date')
  const statusP = req.nextUrl.searchParams.get('status')
  const guard   = await requireShopAccess(shopId)
  if (!guard.ok) return guard.response

  const supabase = createServiceClient()

  let query = supabase
    .from('table_bookings')
    .select(`
      *,
      table:restaurant_tables (id, number, name, capacity)
    `)
    .eq('shop_id', shopId!)
    .order('booked_at', { ascending: true })

  if (dateStr) {
    // Filter by calendar date using UTC+5 bounds
    const dayStart = new Date(`${dateStr}T00:00:00+05:00`).toISOString()
    const dayEnd   = new Date(`${dateStr}T23:59:59+05:00`).toISOString()
    query = query.gte('booked_at', dayStart).lte('booked_at', dayEnd)
  }

  if (statusP) {
    query = query.in('status', statusP.split(',').map(s => s.trim()))
  }

  const { data, error } = await query

  if (error) {
    console.error('[bookings GET]', error)
    return NextResponse.json(err('DB_ERROR', 'Failed to fetch bookings'), { status: 500 })
  }

  return NextResponse.json(ok<TableBooking[]>(data ?? []))
}

/**
 * POST /api/bookings
 *
 * Creates a new booking.
 * Requires: owner (waiters don't manage bookings in this MVP).
 *
 * Body: {
 *   shop_id, table_id, guest_name, guest_phone?,
 *   party_size, booked_at (ISO string), duration_minutes?, notes?
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body   = await req.json()
    const shopId = body?.shop_id as string | undefined
    const guard  = await requireOwnerAccess(shopId)
    if (!guard.ok) return guard.response

    const { userId } = guard.value

    const {
      table_id,
      guest_name,
      guest_phone    = null,
      party_size,
      booked_at,
      duration_minutes = 90,
      notes          = null,
    } = body

    if (!table_id || !guest_name || !party_size || !booked_at) {
      return NextResponse.json(
        err('MISSING_FIELDS', 'table_id, guest_name, party_size, booked_at are required'),
        { status: 400 },
      )
    }

    if (!Number.isInteger(party_size) || party_size < 1) {
      return NextResponse.json(
        err('INVALID_PARTY_SIZE', 'party_size must be a positive integer'),
        { status: 400 },
      )
    }

    // Verify table belongs to this shop
    const supabase = createServiceClient()
    const { data: table } = await supabase
      .from('restaurant_tables')
      .select('id')
      .eq('id', table_id)
      .eq('shop_id', shopId!)
      .single()

    if (!table) {
      return NextResponse.json(err('NOT_FOUND', 'Table not found in this shop'), { status: 404 })
    }

    const { data, error } = await supabase
      .from('table_bookings')
      .insert({
        shop_id:          shopId,
        table_id,
        booked_by:        userId,
        guest_name:       guest_name.trim(),
        guest_phone:      guest_phone ?? null,
        party_size,
        booked_at,
        duration_minutes,
        status:           'confirmed',
        notes:            notes ?? null,
      })
      .select(`*, table:restaurant_tables (id, number, name, capacity)`)
      .single()

    if (error) {
      console.error('[bookings POST]', error)
      return NextResponse.json(err('DB_ERROR', 'Failed to create booking'), { status: 500 })
    }

    return NextResponse.json(ok<TableBooking>(data), { status: 201 })
  } catch (e) {
    console.error('[bookings POST] unexpected:', e)
    return NextResponse.json(err('INTERNAL_ERROR', 'Internal server error'), { status: 500 })
  }
}
