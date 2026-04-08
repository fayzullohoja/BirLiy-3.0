'use client'

import type { ApiResponse, AuthResponse } from '@/lib/types'
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

export async function signOutCurrentSession() {
  await fetch('/api/auth/logout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }).catch(() => null)

  if (typeof window === 'undefined') return

  if (isInTelegram()) {
    getTelegramWebApp()?.close()
    window.setTimeout(() => {
      window.location.replace('/')
    }, 150)
    return
  }

  window.location.replace('/')
}

export function resolveAuthDestination(data: AuthResponse): string {
  if (!data.has_shop_access) return '/not-connected'
  if (!data.subscription_ok) return '/subscription-blocked'

  return data.role === 'super_admin'
    ? '/admin'
    : data.role === 'kitchen'
      ? '/kitchen'
    : data.role === 'owner'
      ? '/owner'
      : '/waiter'
}
