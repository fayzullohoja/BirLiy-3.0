'use client'

import type { ApiResponse, AuthResponse, AuthStatusPayload } from '@/lib/types'
import { getTelegramInitData, getTelegramWebApp, isInTelegram } from '@/lib/telegram/webapp'

export async function refreshTelegramSession(): Promise<AuthResponse> {
  if (!isInTelegram()) {
    throw new Error('Откройте приложение через Telegram Mini App.')
  }

  const initData = getTelegramInitData()
  if (!initData) {
    throw new Error('Telegram initData недоступен. Перезапустите приложение.')
  }

  await fetch('/api/auth/logout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }).catch(() => null)

  const res = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData }),
  })

  const json: ApiResponse<AuthResponse> = await res.json()
  if (json.error) {
    throw new Error(json.error.message)
  }

  return json.data
}

export async function refreshTelegramSessionAndRedirect() {
  const auth = await refreshTelegramSession()
  window.location.replace(resolveAuthDestination(auth))
}

export async function signOutCurrentSession(opts: { redirectTo?: string } = {}) {
  await fetch('/api/auth/logout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }).catch(() => null)

  if (typeof window === 'undefined') return

  const redirectTo = opts.redirectTo ?? '/'

  if (isInTelegram()) {
    getTelegramWebApp()?.close()
    window.setTimeout(() => {
      window.location.replace(redirectTo)
    }, 150)
    return
  }

  window.location.replace(redirectTo)
}

export async function loadAuthStatus(): Promise<AuthStatusPayload> {
  const res = await fetch('/api/auth/status', { cache: 'no-store' })
  const json: ApiResponse<AuthStatusPayload> = await res.json()

  if (json.error) {
    throw new Error(json.error.message)
  }

  return json.data
}

export function resolveAuthDestination(data: AuthResponse): string {
  if (!data.has_shop_access) return '/not-connected'
  if (!data.subscription_ok) return '/subscription-blocked'

  return data.role === 'super_admin'
    ? '/admin'
    : data.role === 'unauthorized'
      ? '/not-connected'
    : data.role === 'kitchen'
      ? '/kitchen'
    : data.role === 'owner' || data.role === 'manager'
      ? '/owner'
      : '/waiter'
}
