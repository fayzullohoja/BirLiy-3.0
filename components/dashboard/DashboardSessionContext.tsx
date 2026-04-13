'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { loadAuthStatus } from '@/lib/auth/clientAuth'
import type { AuthStatusPayload, SubStatus, UserRole } from '@/lib/types'

const DASHBOARD_SHOP_STORAGE_KEY = 'dashboard:selected-shop-id'
const SESSION_REFRESH_MS = 30_000

interface DashboardSessionValue {
  userId: string | null
  role: UserRole | null
  primaryShopId: string | null
  selectedShopId: string | null
  shopIds: string[]
  shops: Array<{ id: string; name: string }>
  shopName: string | null
  expiresAt: string | null
  subStatus: SubStatus | null
  loading: boolean
  refresh: () => Promise<void>
  setSelectedShopId: (shopId: string) => void
}

const DashboardSessionContext = createContext<DashboardSessionValue>({
  userId: null,
  role: null,
  primaryShopId: null,
  selectedShopId: null,
  shopIds: [],
  shops: [],
  shopName: null,
  expiresAt: null,
  subStatus: null,
  loading: true,
  refresh: async () => {},
  setSelectedShopId: () => {},
})

interface DashboardSessionProviderProps {
  children: React.ReactNode
  allowedRoles?: readonly UserRole[]
}

export function DashboardSessionProvider({
  children,
  allowedRoles = ['owner', 'super_admin'],
}: DashboardSessionProviderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [state, setState] = useState<Omit<DashboardSessionValue, 'refresh' | 'setSelectedShopId'>>({
    userId: null,
    role: null,
    primaryShopId: null,
      selectedShopId: null,
      shopIds: [],
      shops: [],
      shopName: null,
      expiresAt: null,
      subStatus: null,
    loading: true,
  })

  const syncSession = useCallback(async () => {
    const data: AuthStatusPayload = await loadAuthStatus()

    if (data.needs_refresh) {
      window.location.replace('/dashboard/login?reason=refresh')
      return
    }

    if (!allowedRoles.includes(data.role)) {
      window.location.replace(resolveRoleFallback(data.role, allowedRoles))
      return
    }

    const searchShopId = typeof window === 'undefined'
      ? null
      : new URLSearchParams(window.location.search).get('shop_id')

    const selectedShopId = resolveSelectedShopId(data, searchShopId)
    const selectedShop = data.shops.find((shop) => shop.id === selectedShopId) ?? null

    if (typeof window !== 'undefined' && selectedShopId) {
      window.localStorage.setItem(DASHBOARD_SHOP_STORAGE_KEY, selectedShopId)
    }

    setState({
      userId: data.user_id,
      role: data.role,
      primaryShopId: data.primary_shop_id,
      selectedShopId,
      shopIds: data.shop_ids,
      shops: data.shops,
      shopName: selectedShop?.name ?? data.shop_name,
      expiresAt: data.expires_at,
      subStatus: data.sub_status,
      loading: false,
    })
  }, [allowedRoles])

  useEffect(() => {
    let cancelled = false

    async function run() {
      try {
        await syncSession()
      } catch {
        if (!cancelled) {
          window.location.replace('/dashboard/login')
        }
      }
    }

    void run()

    const refresh = () => { void run() }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refresh()
    }

    const intervalId = window.setInterval(refresh, SESSION_REFRESH_MS)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [syncSession])

  const setSelectedShopId = useCallback((shopId: string) => {
    if (!shopId) return

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(DASHBOARD_SHOP_STORAGE_KEY, shopId)
    }

    const params = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search)
    params.set('shop_id', shopId)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })

    setState((prev) => ({
      ...prev,
      selectedShopId: shopId,
      shopName: prev.shops.find((shop) => shop.id === shopId)?.name ?? prev.shopName,
    }))
  }, [pathname, router])

  const value = useMemo<DashboardSessionValue>(() => ({
    ...state,
    refresh: syncSession,
    setSelectedShopId,
  }), [setSelectedShopId, state, syncSession])

  return (
    <DashboardSessionContext.Provider value={value}>
      {children}
    </DashboardSessionContext.Provider>
  )
}

export function useDashboardSession() {
  return useContext(DashboardSessionContext)
}

function resolveSelectedShopId(
  data: AuthStatusPayload,
  searchShopId: string | null,
) {
  const shopIds = data.shop_ids ?? []
  if (searchShopId && shopIds.includes(searchShopId)) return searchShopId

  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem(DASHBOARD_SHOP_STORAGE_KEY)
    if (stored && shopIds.includes(stored)) return stored
  }

  if (data.primary_shop_id && shopIds.includes(data.primary_shop_id)) {
    return data.primary_shop_id
  }

  return shopIds[0] ?? null
}

function resolveRoleFallback(role: UserRole, allowedRoles: readonly UserRole[]) {
  if (allowedRoles.includes(role)) {
    return role === 'super_admin' ? '/dashboard/admin' : '/dashboard/owner'
  }

  if (role === 'waiter') return '/waiter'
  if (role === 'kitchen') return '/kitchen'
  if (role === 'owner') return '/dashboard/owner'
  return '/dashboard/admin'
}
