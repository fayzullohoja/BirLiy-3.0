import type { ShopUserRole, UserRole } from '@/lib/types'

export type ManagementShopRole = 'owner' | 'manager'
export type InviteManagedRole = 'manager' | 'waiter' | 'kitchen'

export const SHOP_ROLE_LABELS: Record<ShopUserRole, string> = {
  owner: 'Владелец',
  manager: 'Менеджер',
  waiter: 'Официант',
  kitchen: 'Кухня',
}

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Супер-Админ',
  unauthorized: 'Не авторизован',
  owner: 'Владелец',
  manager: 'Менеджер',
  waiter: 'Официант',
  kitchen: 'Кухня',
}

export const MANAGEMENT_SURFACE_ROLES: readonly UserRole[] = ['owner', 'manager', 'super_admin']

export function canAccessOwnerSurface(role: UserRole | null | undefined) {
  return role === 'owner' || role === 'manager' || role === 'super_admin'
}

export function isManagementShopRole(
  role: ShopUserRole | UserRole | null | undefined,
): role is ManagementShopRole {
  return role === 'owner' || role === 'manager'
}

export function inferShopRoleFromUserRole(
  role: Exclude<UserRole, 'super_admin' | 'unauthorized'>,
): ShopUserRole {
  if (role === 'owner' || role === 'manager' || role === 'waiter' || role === 'kitchen') {
    return role
  }

  return 'waiter'
}

export function normalizePlatformRole(role: UserRole): UserRole {
  return role
}

export function getAssignableShopRoles(
  actorRole: ManagementShopRole | 'super_admin',
): ShopUserRole[] {
  if (actorRole === 'super_admin') {
    return ['owner', 'manager', 'waiter', 'kitchen']
  }

  if (actorRole === 'owner') {
    return ['manager', 'waiter', 'kitchen']
  }

  return ['waiter', 'kitchen']
}

export function getInviteManageableRoles(
  actorRole: ManagementShopRole | 'super_admin',
): InviteManagedRole[] {
  if (actorRole === 'super_admin' || actorRole === 'owner') {
    return ['manager', 'waiter', 'kitchen']
  }

  return ['waiter', 'kitchen']
}

export function canAssignShopRole(
  actorRole: ManagementShopRole | 'super_admin',
  targetRole: ShopUserRole,
) {
  return getAssignableShopRoles(actorRole).includes(targetRole)
}

export function canManageInviteRole(
  actorRole: ManagementShopRole | 'super_admin',
  targetRole: ShopUserRole,
) {
  return getInviteManageableRoles(actorRole).includes(targetRole as InviteManagedRole)
}

export function canRemoveStaffRole(
  actorRole: ManagementShopRole | 'super_admin',
  targetRole: ShopUserRole,
) {
  if (actorRole === 'super_admin') return true
  if (actorRole === 'owner') return targetRole !== 'owner'
  return targetRole === 'waiter' || targetRole === 'kitchen'
}

export function canChangeStaffRole(
  actorRole: ManagementShopRole | 'super_admin',
  currentRole: ShopUserRole,
  nextRole: ShopUserRole,
) {
  if (!canRemoveStaffRole(actorRole, currentRole)) return false
  return canAssignShopRole(actorRole, nextRole)
}
