'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { loadAuthStatus, refreshTelegramSessionAndRedirect } from '@/lib/auth/clientAuth'
import type { AuthStatusPayload, UserRole } from '@/lib/types'

interface KitchenSession {
  userId: string | null
  role: UserRole | null
  primaryShopId: string | null
  shopName: string | null
  loading: boolean
}

const KitchenSessionContext = createContext<KitchenSession>({
  userId: null,
  role: null,
  primaryShopId: null,
  shopName: null,
  loading: true,
})

export function useKitchenSession() {
  return useContext(KitchenSessionContext)
}

const SESSION_REFRESH_MS = 30_000

export function KitchenSessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<KitchenSession>({
    userId: null,
    role: null,
    primaryShopId: null,
    shopName: null,
    loading: true,
  })

  useEffect(() => {
    let cancelled = false

    async function syncSession() {
      try {
        const data: AuthStatusPayload = await loadAuthStatus()
        if (cancelled) return

        if (data.needs_refresh) {
          await refreshTelegramSessionAndRedirect()
          return
        }

        if (data.primary_shop_id) {
          setState({
            userId: data.user_id,
            role: data.role,
            primaryShopId: data.primary_shop_id,
            shopName: data.shop_name,
            loading: false,
          })
          return
        }

        window.location.replace('/')
      } catch {
        if (!cancelled) {
          window.location.replace('/')
        }
      }
    }

    void syncSession()

    const refresh = () => { void syncSession() }
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
  }, [])

  return (
    <KitchenSessionContext.Provider value={state}>
      {children}
    </KitchenSessionContext.Provider>
  )
}
