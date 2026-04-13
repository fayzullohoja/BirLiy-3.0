import type { AppUser, Shop, ShopUser, Subscription } from '@/lib/types'

type MaybeRelation<T> = T | T[] | null | undefined

export type AdminShopMember = Omit<ShopUser, 'user'> & {
  user?: AppUser | null
}

export interface AdminShopRecord extends Shop {
  subscription?: MaybeRelation<Subscription>
  members?: Array<
    Omit<ShopUser, 'user'> & {
      user?: MaybeRelation<AppUser>
    }
  >
}

export interface NormalizedAdminShopRecord extends Shop {
  subscription: Subscription | null
  members: AdminShopMember[]
}

export function normalizeAdminShopRecord(shop: AdminShopRecord): NormalizedAdminShopRecord {
  return {
    ...shop,
    subscription: unwrapRelation(shop.subscription),
    members: (shop.members ?? []).map((member) => ({
      ...member,
      user: unwrapRelation(member.user),
    })),
  }
}

export function normalizeAdminShopRecords(shops: AdminShopRecord[]) {
  return shops.map((shop) => normalizeAdminShopRecord(shop))
}

export function unwrapRelation<T>(value: MaybeRelation<T>) {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export function getShopOwnerName(shop: NormalizedAdminShopRecord) {
  return shop.members.find((member) => member.role === 'owner')?.user?.name ?? '—'
}

export function daysLeft(expiresAt: string) {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000))
}
