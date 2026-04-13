import type { ShopUserRole, UserRole } from '@/lib/types'

export type AdminShopMembership = {
  id: string
  role: ShopUserRole
  shop_id: string
  created_at?: string
  shop: { id: string; name: string; is_active: boolean } | { id: string; name: string; is_active: boolean }[] | null
}

export type AdminUserRecord = {
  id: string
  telegram_id: number
  name: string
  username: string | null
  role: UserRole
  created_at: string
  updated_at: string
  shops?: AdminShopMembership[]
}

export function mapAdminUser<T extends AdminUserRecord>(user: T): T {
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
    return bTime - aTime
  })[0] ?? null
}

function normalizeMemberships(shops: AdminShopMembership[]) {
  return shops
    .map((membership) => ({
      ...membership,
      shop: Array.isArray(membership.shop) ? membership.shop[0] ?? null : membership.shop,
    }))
    .sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0
      return bTime - aTime
    })
}
