'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getTelegramInitData, isInTelegram } from '@/lib/telegram/webapp'
import LoadingScreen from '@/components/shared/LoadingScreen'
import type { AuthResponse, ApiResponse } from '@/lib/types'

/**
 * Entry point.
 *
 * Auth flow:
 *  1. Grab Telegram initData from the WebApp SDK.
 *  2. POST /api/auth — server validates HMAC, upserts user, issues session JWT cookie.
 *  3. Read role + access flags from response.
 *  4. Redirect to the correct dashboard OR gateway page.
 *
 * Dev mode:
 *  - ?role=waiter|kitchen|owner|admin  bypasses Telegram validation.
 *  - A real session cookie is still issued via the dev auth path.
 */

type AuthStage = 'initializing' | 'authenticating' | 'redirecting' | 'error'

export default function RootPage() {
  const router = useRouter()
  const [stage, setStage]   = useState<AuthStage>('initializing')
  const [errMsg, setErrMsg] = useState<string>('')
  const didRun = useRef(false) // StrictMode guard

  useEffect(() => {
    if (didRun.current) return
    didRun.current = true
    runAuthFlow()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function runAuthFlow() {
    setStage('authenticating')

    try {
      const params   = new URLSearchParams(window.location.search)
      const devRole  = params.get('role')

      let body: Record<string, unknown>

      if (devRole && ['waiter', 'kitchen', 'owner', 'super_admin', 'admin'].includes(devRole)) {
        // Dev bypass — map 'admin' alias
        const mappedRole = devRole === 'admin' ? 'super_admin' : devRole
        body = {
          dev_role:        mappedRole,
          dev_telegram_id: 99900000 + Math.floor(Math.random() * 1000),
        }
      } else if (isInTelegram()) {
        const initData = getTelegramInitData()
        if (!initData) {
          throw new Error('Telegram initData недоступен. Перезапустите приложение.')
        }
        body = { initData }
      } else {
        // Non-Telegram browser access: show friendly error
        setStage('error')
        setErrMsg('Откройте приложение через Telegram Mini App.')
        return
      }

      const res = await fetch('/api/auth', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })

      const json: ApiResponse<AuthResponse> = await res.json()

      if (json.error) {
        throw new Error(json.error.message)
      }

      const { role, has_shop_access, subscription_ok } = json.data

      setStage('redirecting')

      if (!has_shop_access) {
        router.replace('/not-connected')
        return
      }
      if (!subscription_ok) {
        router.replace('/subscription-blocked')
        return
      }

      const destination =
        role === 'super_admin' ? '/admin' :
        role === 'kitchen'     ? '/kitchen' :
        role === 'owner'       ? '/owner' :
        '/waiter'

      router.replace(destination)
    } catch (e) {
      console.error('[auth flow]', e)
      setStage('error')
      setErrMsg(e instanceof Error ? e.message : 'Неизвестная ошибка авторизации')
    }
  }

  if (stage === 'error') {
    return <AuthErrorScreen message={errMsg} onRetry={() => {
      setStage('initializing')
      setErrMsg('')
      didRun.current = false
      runAuthFlow()
    }} />
  }

  const messages: Record<AuthStage, string> = {
    initializing:   'Запуск...',
    authenticating: 'Авторизация...',
    redirecting:    'Входим...',
    error:          '',
  }

  return <LoadingScreen message={messages[stage]} />
}

// ─── Error screen ─────────────────────────────────────────────────────────────

function AuthErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mb-5">
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#e53e3e"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>

      <h1 className="text-lg font-bold text-ink mb-2">Ошибка входа</h1>
      <p className="text-sm text-ink-secondary mb-8 max-w-xs">{message}</p>

      <button
        onClick={onRetry}
        className="h-12 px-8 rounded-2xl bg-brand-600 text-white font-semibold text-base
          hover:bg-brand-700 active:bg-brand-800 transition-colors"
      >
        Попробовать снова
      </button>
    </div>
  )
}
