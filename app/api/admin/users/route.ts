import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/auth/apiGuard'
import { err, ok } from '@/lib/utils'
import type { ShopUserRole, UserRole } from '@/lib/types'

/**
 * GET /api/admin/users?role=waiter&search=text
 * List all platform users with their shop memberships.
 * Optional query params:
 *   role   — filter by user_role (super_admin | owner | waiter | kitchen)
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
        id, role, shop_id, created_at,
        shop:shops (id, name, is_active)
      )
    `)
    .order('created_at', { ascending: false })

  if (search) {
    query = query.or(`name.ilike.%${search}%,username.ilike.%${search}%`)
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

type AdminShopMembership = {
  id: string
  role: ShopUserRole
  shop_id: string
  created_at?: string
  shop: { id: string; name: string; is_active: boolean } | { id: string; name: string; is_active: boolean }[] | null
}

type AdminUserRecord = {
  id: string
  telegram_id: number
  name: string
  username: string | null
  role: UserRole
  created_at: string
  updated_at: string
  shops?: AdminShopMembership[]
}

function mapAdminUser<T extends AdminUserRecord>(user: T): T {
  const normalizedShops = normalizeMemberships(user.shops ?? [])
  const primaryMembership = resolvePrimaryMembership(normalizedShops)
  const effectiveRole: UserRole =
    user.role === 'super_admin'
      ? 'super_admin'
      : primaryMembership?.role ?? user.role

  return {
    ...user,
    role: effectiveRole,
    shops: normalizedShops,
  }
}

function resolvePrimaryMembership(shops: AdminShopMembership[]) {
  return [...shops].sort((a, b) => {
    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0
    return aTime - bTime
  })[0] ?? null
}

function normalizeMemberships(shops: AdminShopMembership[]) {
  return shops.map((membership) => ({
    ...membership,
    shop: Array.isArray(membership.shop) ? membership.shop[0] ?? null : membership.shop,
  }))
}
