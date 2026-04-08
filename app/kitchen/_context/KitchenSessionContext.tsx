'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import type { UserRole } from '@/lib/types'

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

interface StatusResponse {
  data: {
    user_id: string
    role: UserRole
    primary_shop_id: string | null
    shop_name: string | null
  } | null
  error: { code: string; message: string } | null
}

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

    fetch('/api/auth/status')
      .then(r => r.json() as Promise<StatusResponse>)
      .then(res => {
        if (cancelled) return
        if (res.data?.primary_shop_id) {
          setState({
            userId: res.data.user_id,
            role: res.data.role,
            primaryShopId: res.data.primary_shop_id,
            shopName: res.data.shop_name,
            loading: false,
          })
          return
        }
        window.location.replace('/')
      })
      .catch(() => {
        if (!cancelled) window.location.replace('/')
      })

    return () => { cancelled = true }
  }, [])

  return (
    <KitchenSessionContext.Provider value={state}>
      {children}
    </KitchenSessionContext.Provider>
  )
}
