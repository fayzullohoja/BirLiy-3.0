import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireOwnerAccess } from '@/lib/auth/apiGuard'
import { err, ok } from '@/lib/utils'
import type { ShopUser } from '@/lib/types'

/**
 * GET /api/staff?shop_id=xxx
 * Returns all members of the shop with user details.
 * Requires: owner.
 */
export async function GET(req: NextRequest) {
  const shopId = req.nextUrl.searchParams.get('shop_id')
  const guard  = await requireOwnerAccess(shopId)
  if (!guard.ok) return guard.response

  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('shop_users')
    .select(`
      id, shop_id, user_id, role, created_at,
      user:users (id, name, username, telegram_id, role, created_at, updated_at)
    `)
    .eq('shop_id', shopId!)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[staff GET]', error)
    return NextResponse.json(err('DB_ERROR', 'Failed to fetch staff'), { status: 500 })
  }

  const staff: ShopUser[] = (data ?? []).map((row) => ({
    ...row,
    user: Array.isArray(row.user) ? row.user[0] : row.user,
  }))

  return NextResponse.json(ok<ShopUser[]>(staff))
}

/**
 * DELETE /api/staff?shop_id=xxx&user_id=yyy
 * Removes a member from the shop.
 * Cannot remove the owner themselves.
 * Requires: owner.
 */
export async function DELETE(req: NextRequest) {
  try {
    const shopId = req.nextUrl.searchParams.get('shop_id')
    const userId = req.nextUrl.searchParams.get('user_id')
    const guard  = await requireOwnerAccess(shopId)
    if (!guard.ok) return guard.response

    if (!userId) {
      return NextResponse.json(err('MISSING_PARAM', 'user_id is required'), { status: 400 })
    }

    // Prevent owner from removing themselves
    if (userId === guard.value.userId) {
      return NextResponse.json(
        err('FORBIDDEN', 'You cannot remove yourself from the shop'),
        { status: 403 },
      )
    }

    const supabase = createServiceClient()
    const { error } = await supabase
      .from('shop_users')
      .delete()
      .eq('shop_id', shopId!)
      .eq('user_id', userId)

    if (error) {
      console.error('[staff DELETE]', error)
      return NextResponse.json(err('DB_ERROR', 'Failed to remove staff member'), { status: 500 })
    }

    return new NextResponse(null, { status: 204 })
  } catch (e) {
    console.error('[staff DELETE] unexpected:', e)
    return NextResponse.json(err('INTERNAL_ERROR', 'Internal server error'), { status: 500 })
  }
}
