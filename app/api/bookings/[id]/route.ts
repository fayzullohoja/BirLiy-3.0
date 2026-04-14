import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireManagementAccess } from '@/lib/auth/apiGuard'
import { err, ok } from '@/lib/utils'
import type { BookingStatus, TableBooking } from '@/lib/types'

const VALID_STATUSES: BookingStatus[] = ['confirmed', 'seated', 'cancelled', 'no_show']

/**
 * PATCH /api/bookings/[id]
 *
 * Updates a booking's status or editable fields.
 * Side effects:
 *   - confirmed → set table to 'reserved' (if currently free/reserved)
 *   - seated    → set table to 'occupied' (if currently free/reserved)
 *   - cancelled/no_show → no automatic table change (owner handles it)
 *
 * Requires: owner or manager.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id }     = await params
    const body       = await req.json()
    const supabase   = createServiceClient()

    const { data: booking } = await supabase
      .from('table_bookings')
      .select('id, shop_id, table_id, status')
      .eq('id', id)
      .single()

    if (!booking) {
      return NextResponse.json(err('NOT_FOUND', 'Booking not found'), { status: 404 })
    }

    const guard = await requireManagementAccess(booking.shop_id)
    if (!guard.ok) return guard.response

    if (body.status && !VALID_STATUSES.includes(body.status)) {
      return NextResponse.json(
        err('INVALID_STATUS', `status must be one of: ${VALID_STATUSES.join(', ')}`),
        { status: 400 },
      )
    }

    // Strip untrusted fields
    const safeBody = { ...body }
    delete safeBody.shop_id
    delete safeBody.id

    const {
      guest_name, guest_phone, party_size, booked_at, duration_minutes, notes, status,
    } = safeBody

    const updates: Record<string, unknown> = {}
    if (status           !== undefined) updates.status           = status
    if (guest_name       !== undefined) updates.guest_name       = String(guest_name).trim()
    if (guest_phone      !== undefined) updates.guest_phone      = guest_phone ?? null
    if (party_size       !== undefined) updates.party_size       = party_size
    if (booked_at        !== undefined) updates.booked_at        = booked_at
    if (duration_minutes !== undefined) updates.duration_minutes = duration_minutes
    if (notes            !== undefined) updates.notes            = notes ?? null

    const { data, error } = await supabase
      .from('table_bookings')
      .update(updates)
      .eq('id', id)
      .select(`*, table:restaurant_tables (id, number, name, capacity)`)
      .single()

    if (error) {
      console.error('[bookings PATCH]', error)
      return NextResponse.json(err('DB_ERROR', 'Failed to update booking'), { status: 500 })
    }

    // Reflect booking status on table
    if (status === 'confirmed') {
      await supabase
        .from('restaurant_tables')
        .update({ status: 'reserved' })
        .eq('id', booking.table_id)
        .in('status', ['free', 'reserved'])
    } else if (status === 'seated') {
      await supabase
        .from('restaurant_tables')
        .update({ status: 'occupied' })
        .eq('id', booking.table_id)
        .in('status', ['free', 'reserved'])
    }

    return NextResponse.json(ok<TableBooking>(data))
  } catch (e) {
    console.error('[bookings PATCH] unexpected:', e)
    return NextResponse.json(err('INTERNAL_ERROR', 'Internal server error'), { status: 500 })
  }
}

/**
 * DELETE /api/bookings/[id]
 * Removes a booking. If it was confirmed, frees the table.
 * Requires: owner or manager.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id }   = await params
    const supabase = createServiceClient()

    const { data: booking } = await supabase
      .from('table_bookings')
      .select('shop_id, table_id, status')
      .eq('id', id)
      .single()

    if (!booking) {
      return NextResponse.json(err('NOT_FOUND', 'Booking not found'), { status: 404 })
    }

    const guard = await requireManagementAccess(booking.shop_id)
    if (!guard.ok) return guard.response

    const { error } = await supabase.from('table_bookings').delete().eq('id', id)

    if (error) {
      console.error('[bookings DELETE]', error)
      return NextResponse.json(err('DB_ERROR', 'Failed to delete booking'), { status: 500 })
    }

    // Free the table if it was reserved because of this booking
    if (booking.status === 'confirmed') {
      await supabase
        .from('restaurant_tables')
        .update({ status: 'free' })
        .eq('id', booking.table_id)
        .eq('status', 'reserved')
    }

    return new NextResponse(null, { status: 204 })
  } catch (e) {
    console.error('[bookings DELETE] unexpected:', e)
    return NextResponse.json(err('INTERNAL_ERROR', 'Internal server error'), { status: 500 })
  }
}
