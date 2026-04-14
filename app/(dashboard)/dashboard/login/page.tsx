'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from '@/components/ui/Toast'

type WidgetAuthUser = Record<string, unknown>

export default function DashboardLoginPage() {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [busy, setBusy] = useState(false)
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? ''

  const missingBotUsername = useMemo(() => botUsername.trim().length === 0, [botUsername])

  useEffect(() => {
    if (missingBotUsername || !containerRef.current) return

    let disposed = false
    const container = containerRef.current

    async function onTelegramAuth(user: WidgetAuthUser) {
      setBusy(true)

      try {
        const res = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tg_widget: user }),
        })

        const json = await res.json()
        if (json.error) {
          toast.error(json.error.message)
          return
        }

        const role = json.data?.role
        if (role === 'super_admin') {
          router.replace('/dashboard/admin')
          return
        }

        if (role === 'owner' || role === 'manager') {
          router.replace('/dashboard/owner')
          return
        }

        router.replace('/dashboard/not-authorized')
      } catch {
        toast.error('Не удалось авторизовать dashboard-сессию')
      } finally {
        if (!disposed) setBusy(false)
      }
    }

    const win = window as Window & { onTelegramAuth?: (user: WidgetAuthUser) => void }
    win.onTelegramAuth = onTelegramAuth

    container.innerHTML = ''

    const script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.async = true
    script.setAttribute('data-telegram-login', botUsername)
    script.setAttribute('data-size', 'large')
    script.setAttribute('data-radius', '14')
    script.setAttribute('data-request-access', 'write')
    script.setAttribute('data-onauth', 'onTelegramAuth(user)')
    container.appendChild(script)

    return () => {
      disposed = true
      delete win.onTelegramAuth
      container.innerHTML = ''
    }
  }, [botUsername, missingBotUsername, router])

  return (
    <div className="min-h-screen bg-surface-muted px-4 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md items-center justify-center">
        <div className="w-full rounded-[28px] border border-surface-border bg-white p-8 text-center shadow-card-lg">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-600 text-2xl font-bold text-white">
            B
          </div>
          <h1 className="text-2xl font-bold text-ink">BirLiy Kassa</h1>
          <p className="mt-2 text-sm text-ink-secondary">
            Вход в web dashboard через Telegram Login Widget
          </p>

          <div className="mt-8 rounded-3xl border border-surface-border bg-surface-muted p-5">
            {missingBotUsername ? (
              <p className="text-sm font-medium text-danger">
                Не задан `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`. Добавь переменную окружения перед запуском dashboard.
              </p>
            ) : (
              <>
                <div ref={containerRef} className="flex justify-center" />
                <p className="mt-4 text-xs text-ink-muted">
                  Доступ для владельцев, менеджеров заведений и супер-администраторов платформы.
                </p>
              </>
            )}
          </div>

          {busy && (
            <p className="mt-5 text-sm font-medium text-brand-700">
              Проверяем Telegram-подпись и поднимаем сессию…
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
