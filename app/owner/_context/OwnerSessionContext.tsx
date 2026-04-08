'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import type { UserRole } from '@/lib/types'

interface OwnerSession {
  userId:        string | null
  role:          UserRole | null
  primaryShopId: string | null
  loading:       boolean
}

type OwnerSessionState = OwnerSession

const OwnerSessionContext = createContext<OwnerSessionState>({
  userId:        null,
  role:          null,
  primaryShopId: null,
  loading:       true,
})

export function useOwnerSession() {
  return useContext(OwnerSessionContext)
}

interface StatusResponse {
  data: {
    user_id:         string
    role:            UserRole
    primary_shop_id: string | null
  } | null
  error: { code: string; message: string } | null
}

export function OwnerSessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<OwnerSessionState>({
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
        if (res.data?.primary_shop_id) {
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
    <OwnerSessionContext.Provider value={state}>
      {children}
    </OwnerSessionContext.Provider>
  )
}
