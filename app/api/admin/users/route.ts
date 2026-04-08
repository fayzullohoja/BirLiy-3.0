import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/auth/apiGuard'
import { err, ok } from '@/lib/utils'

/**
 * GET /api/admin/users?role=waiter&search=text
 * List all platform users with their shop memberships.
 * Optional query params:
 *   role   — filter by user_role (super_admin | owner | waiter)
 *   search — partial match on name or username (case-insensitive)
 * Requires: super_admin.
 */
export async function GET(req: NextRequest) {
  const guard = await requireSuperAdmin()
  if (!guard.ok) return guard.response

  const role   = req.nextUrl.searchParams.get('role')
  const search = req.nextUrl.searchParams.get('search')?.trim()

  const supabase = createServiceClient()

  let query = supabase
    .from('users')
    .select(`
      id, telegram_id, name, username, role, created_at, updated_at,
      shops:shop_users (
        id, role, shop_id,
        shop:shops (id, name, is_active)
      )
    `)
    .order('created_at', { ascending: false })

  if (role) {
    query = query.eq('role', role)
  }
  if (search) {
    query = query.or(`name.ilike.%${search}%,username.ilike.%${search}%`)
  }

  const { data, error } = await query

  if (error) {
    console.error('[admin/users GET]', error)
    return NextResponse.json(err('DB_ERROR', 'Failed to fetch users'), { status: 500 })
  }

  return NextResponse.json(ok(data ?? []))
}
