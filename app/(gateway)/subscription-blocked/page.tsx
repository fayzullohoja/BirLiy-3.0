'use client'

import { useEffect, useState } from 'react'

interface SubInfo {
  shopName:   string
  expiresAt:  string
  status:     string
}

/**
 * Shown when a user's shop has an expired or suspended subscription.
 *
 * Only the owner or super_admin can resolve this.
 * Waiters see a "contact your manager" message.
 */
export default function SubscriptionBlockedPage() {
  const [info, setInfo]       = useState<SubInfo | null>(null)
  const [isOwner, setIsOwner] = useState(false)

  useEffect(() => {
    // Read the session cookie claims via a lightweight status endpoint
    fetch('/api/auth/status')
      .then((r) => r.json())
      .then((data) => {
        if (data?.data) {
          setIsOwner(data.data.role === 'owner' || data.data.role === 'super_admin')
          if (data.data.shop_name) {
            setInfo({
              shopName:  data.data.shop_name,
              expiresAt: data.data.expires_at ?? '',
              status:    data.data.sub_status  ?? 'expired',
            })
          }
        }
      })
      .catch(() => {/* best-effort, show generic UI */})
  }, [])

  const isSuspended = info?.status === 'suspended'

  return (
    <div className="w-full max-w-sm mx-auto text-center animate-fade-in">
      {/* Illustration */}
      <div className="w-20 h-20 rounded-3xl bg-red-50 border border-red-200 flex items-center justify-center mx-auto mb-6">
        <svg
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#e53e3e"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>

      {/* Title */}
      <h1 className="text-xl font-bold text-ink mb-2">
        {isSuspended ? 'Доступ приостановлен' : 'Подписка истекла'}
      </h1>

      {/* Shop name */}
      {info?.shopName && (
        <p className="text-sm font-medium text-brand-600 mb-2">{info.shopName}</p>
      )}

      {/* Description */}
      <p className="text-sm text-ink-secondary leading-relaxed mb-8">
        {isSuspended
          ? 'Доступ к системе был приостановлен. Свяжитесь с поддержкой BirLiy для восстановления.'
          : isOwner
          ? 'Срок действия подписки истёк. Продлите подписку, чтобы продолжить работу.'
          : 'Срок действия подписки заведения истёк. Сообщите об этом вашему руководителю.'}
      </p>

      {/* Owner: show renewal CTA */}
      {isOwner && !isSuspended && (
        <div className="card p-4 mb-6 text-left space-y-3">
          <p className="section-label">Продлить подписку</p>
          <p className="text-sm text-ink-secondary">
            Напишите в поддержку BirLiy через Telegram или свяжитесь с нами напрямую.
          </p>
          <a
            href="https://t.me/birliy_support"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 h-10 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-colors"
          >
            <TelegramIcon />
            Написать в поддержку
          </a>
        </div>
      )}

      {/* Waiter: simpler message */}
      {!isOwner && (
        <div className="card p-4 mb-6 text-left">
          <p className="text-sm text-ink-secondary">
            Работа приложения остановлена до продления подписки. Пожалуйста, сообщите об этом
            владельцу заведения.
          </p>
        </div>
      )}

      {/* Retry — checks if subscription was renewed */}
      <button
        onClick={() => window.location.replace('/')}
        className="w-full h-12 rounded-2xl border border-surface-border text-ink-secondary font-semibold text-sm
          hover:bg-surface-muted active:bg-surface-border transition-colors"
      >
        Проверить снова
      </button>
    </div>
  )
}

function TelegramIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.372 0 0 5.373 0 12s5.372 12 12 12 12-5.373 12-12S18.628 0 12 0zm5.562 8.248l-2.04 9.607c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.903.614z" />
    </svg>
  )
}
