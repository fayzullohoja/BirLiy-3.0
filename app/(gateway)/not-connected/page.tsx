'use client'

import { useEffect, useState } from 'react'
import { getTelegramUser } from '@/lib/telegram/webapp'

/**
 * Shown when a Telegram user has successfully authenticated
 * but is not yet linked to any shop (no shop_users record).
 *
 * This happens when:
 *  - The user is new and hasn't been invited yet.
 *  - Their invite was revoked.
 *
 * The owner must add them via /owner/staff.
 */
export default function NotConnectedPage() {
  const [telegramName, setTelegramName] = useState<string>('')

  useEffect(() => {
    const tgUser = getTelegramUser()
    if (tgUser) {
      setTelegramName(tgUser.first_name)
    }
  }, [])

  return (
    <div className="w-full max-w-sm mx-auto text-center animate-fade-in">
      {/* Illustration */}
      <div className="w-20 h-20 rounded-3xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-6">
        <svg
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#d97706"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <line x1="20" y1="8" x2="20" y2="14" />
          <line x1="23" y1="11" x2="17" y2="11" />
        </svg>
      </div>

      {/* Title */}
      <h1 className="text-xl font-bold text-ink mb-2">
        {telegramName ? `${telegramName}, вас ещё нет в системе` : 'Вы ещё не подключены'}
      </h1>

      {/* Description */}
      <p className="text-sm text-ink-secondary leading-relaxed mb-8">
        Ваш аккаунт Telegram зарегистрирован, но не привязан ни к одному заведению.
        Попросите вашего руководителя добавить вас через раздел&nbsp;
        <span className="font-semibold text-ink">«Персонал»</span>.
      </p>

      {/* Instruction steps */}
      <div className="card p-4 text-left mb-8 space-y-3">
        <p className="section-label">Что делать</p>
        <Step n={1} text="Сообщите владельцу заведения ваш Telegram-аккаунт" />
        <Step n={2} text="Он добавит вас в разделе «Персонал → Официанты»" />
        <Step n={3} text="После добавления перезапустите приложение" />
      </div>

      {/* Retry button */}
      <RetryButton />
    </div>
  )
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
        {n}
      </span>
      <p className="text-sm text-ink-secondary">{text}</p>
    </div>
  )
}

function RetryButton() {
  const [loading, setLoading] = useState(false)

  async function handleRetry() {
    setLoading(true)
    // Re-trigger auth to pick up any new shop assignments
    window.location.replace('/')
  }

  return (
    <button
      onClick={handleRetry}
      disabled={loading}
      className="w-full h-12 rounded-2xl bg-brand-600 text-white font-semibold text-base
        hover:bg-brand-700 active:bg-brand-800 transition-colors
        disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {loading ? 'Проверяем...' : 'Проверить снова'}
    </button>
  )
}
