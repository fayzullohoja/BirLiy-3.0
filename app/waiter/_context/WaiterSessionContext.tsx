'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import type { UserRole } from '@/lib/types'

interface WaiterSession {
  userId:        string | null
  role:          UserRole | null
  primaryShopId: string | null
  loading:       boolean
}

type WaiterSessionState = WaiterSession

const WaiterSessionContext = createContext<WaiterSessionState>({
  userId:        null,
  role:          null,
  primaryShopId: null,
  loading:       true,
})

export function useWaiterSession() {
  return useContext(WaiterSessionContext)
}

interface StatusResponse {
  data: {
    user_id:         string
    role:            UserRole
    primary_shop_id: string | null
  } | null
  error: { code: string; message: string } | null
}

export function WaiterSessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<WaiterSessionState>({
    userId:        null,
    role:          null,
    primaryShopId: null,
    loading:       true,
  })

  useEffect(() => {
    let cancelled = false

    fetch('/api/auth/status')
      .then(r => r.json() as Promise<StatusResponse>)
      .then(res => {
        if (cancelled) return
        if (res.data && res.data.primary_shop_id) {
          setState({
            userId:        res.data.user_id,
            role:          res.data.role,
            primaryShopId: res.data.primary_shop_id,
            loading:       false,
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
    <WaiterSessionContext.Provider value={state}>
      {children}
    </WaiterSessionContext.Provider>
  )
}
