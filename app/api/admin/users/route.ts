import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth, requireManagementAccess } from '@/lib/auth/apiGuard'
import { err, ok } from '@/lib/utils'
import { mapAdminUser, type AdminUserRecord } from '@/lib/admin/userUtils'

/**
 * GET /api/admin/users?role=waiter&search=text
 * List all platform users with their shop memberships.
 * Optional query params:
 *   role   — filter by user_role (super_admin | unauthorized | owner | manager | waiter | kitchen)
 *   search — partial match on name or username (case-insensitive)
 * Requires: super_admin.
 * Owner dashboard may also call this endpoint with ?shop_id=... to search
 * existing users for assignment into the current shop.
 */
export async function GET(req: NextRequest) {
  const role   = req.nextUrl.searchParams.get('role')
  const search = req.nextUrl.searchParams.get('search')?.trim()
  const shopId = req.nextUrl.searchParams.get('shop_id')

  const authGuard = await requireAuth()
  if (!authGuard.ok) return authGuard.response

  const isSuperAdmin = authGuard.value.role === 'super_admin'
  if (!isSuperAdmin) {
    const managementGuard = await requireManagementAccess(shopId)
    if (!managementGuard.ok) return managementGuard.response
  }

  const supabase = createServiceClient()

  let query = supabase
    .from('users')
    .select(`
      id, telegram_id, name, username, role, created_at, updated_at,
      shops:shop_users (
        id, role, shop_id, created_at,
        shop:shops (id, name, is_active)
      )
    `)
    .order('created_at', { ascending: false })

  if (search) {
    query = query.or(`name.ilike.%${search}%,username.ilike.%${search}%`)
  }
  if (!isSuperAdmin) {
    query = query.neq('role', 'super_admin')
  }

  const { data, error } = await query

  if (error) {
    console.error('[admin/users GET]', error)
    return NextResponse.json(err('DB_ERROR', 'Failed to fetch users'), { status: 500 })
  }

  const users = ((data ?? []) as AdminUserRecord[]).map((user) => mapAdminUser(user))
  const filtered = role
    ? users.filter((user) => user.role === role)
    : users

  return NextResponse.json(ok(filtered))
}
