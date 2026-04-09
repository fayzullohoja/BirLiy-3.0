'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { loadAuthStatus, refreshTelegramSessionAndRedirect } from '@/lib/auth/clientAuth'
import type { AuthStatusPayload, UserRole } from '@/lib/types'

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

const SESSION_REFRESH_MS = 30_000

export function OwnerSessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<OwnerSessionState>({
    userId:        null,
    role:          null,
    primaryShopId: null,
    loading:       true,
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
            userId:        data.user_id,
            role:          data.role,
            primaryShopId: data.primary_shop_id,
            loading:       false,
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
    <OwnerSessionContext.Provider value={state}>
      {children}
    </OwnerSessionContext.Provider>
  )
}
