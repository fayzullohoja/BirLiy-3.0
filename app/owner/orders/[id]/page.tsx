'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { OrderItemStatusBadge, OrderStatusBadge } from '@/components/ui/Badge'
import { formatUZS, formatTime, formatDate, PAYMENT_TYPE_LABELS, ORDER_STATUS_LABELS } from '@/lib/utils'
import type { Order } from '@/lib/types'

export default function OwnerOrderDetailPage() {
  const { id }  = useParams<{ id: string }>()
  const router  = useRouter()

  const [order, setOrder]     = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  // Telegram back button
  const tgBack = useRef<(() => void) | null>(null)
  useEffect(() => {
    const tg = (window as Window & { Telegram?: { WebApp?: { BackButton?: { show(): void; hide(): void; onClick(fn: () => void): void; offClick(fn: () => void): void } } } }).Telegram?.WebApp
    if (!tg?.BackButton) return
    tgBack.current = () => router.back()
    tg.BackButton.show()
    tg.BackButton.onClick(tgBack.current)
    return () => { if (tgBack.current) tg.BackButton?.offClick(tgBack.current); tg.BackButton?.hide() }
  }, [router])

  useEffect(() => {
    fetch(`/api/orders/${id}`)
      .then(r => r.json())
      .then(res => {
        if (res.error) setError(res.error.message)
        else setOrder(res.data)
      })
      .catch(() => setError('Не удалось загрузить заказ'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <DetailSkeleton />

  if (error || !order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-ink-secondary text-center">{error ?? 'Заказ не найден'}</p>
        <button onClick={() => router.back()} className="text-brand-600 font-medium">Назад</button>
      </div>
    )
  }

  const items = order.items ?? []
  const closedAt = order.status === 'paid' || order.status === 'cancelled' ? order.updated_at : null

  return (
    <div className="min-h-screen bg-surface-muted pb-safe">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-surface border-b border-surface-border px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 flex items-center justify-center rounded-xl text-ink-secondary hover:bg-surface-muted shrink-0"
          aria-label="Назад"
        >
          <BackIcon />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold text-ink truncate">
            {order.table?.name ?? 'Стол'} — Заказ #{order.id.slice(-6).toUpperCase()}
          </h1>
          <p className="text-xs text-ink-muted">{formatDate(order.created_at)} · {formatTime(order.created_at)}</p>
        </div>
        <OrderStatusBadge status={order.status} />
      </header>

      <div className="p-4 flex flex-col gap-4">

        {/* Meta card */}
        <div className="bg-surface rounded-2xl border border-surface-border">
          <Row label="Официант"  value={order.waiter?.name ?? '—'} />
          <Row label="Статус"    value={ORDER_STATUS_LABELS[order.status] ?? order.status} />
          {order.payment_type && (
            <Row label="Оплата"  value={PAYMENT_TYPE_LABELS[order.payment_type]} />
          )}
          {closedAt && (
            <Row label="Закрыт"  value={`${formatDate(closedAt)} в ${formatTime(closedAt)}`} />
          )}
        </div>

        {/* Items */}
        <div className="bg-surface rounded-2xl border border-surface-border overflow-hidden">
          <div className="px-4 py-2.5 border-b border-surface-border">
            <p className="text-xs font-semibold text-ink-secondary uppercase tracking-wide">Состав заказа</p>
          </div>
          {items.length === 0 ? (
            <p className="text-center text-sm text-ink-muted py-6">Нет позиций</p>
          ) : (
            <ul className="divide-y divide-surface-border">
              {items.map((item) => (
                <li key={item.id} className="flex items-center justify-between px-4 py-3 gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-ink">{item.menu_item?.name ?? 'Позиция'}</p>
                      <OrderItemStatusBadge status={item.status} />
                    </div>
                    <p className="text-xs text-ink-muted">{formatUZS(item.unit_price)} × {item.quantity}</p>
                    {item.notes && (
                      <p className="text-xs text-ink-secondary mt-1">{item.notes}</p>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-ink shrink-0">
                    {formatUZS(item.unit_price * item.quantity)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Total */}
        <div className="bg-surface rounded-2xl border border-surface-border px-4 py-4 flex justify-between items-center">
          <span className="font-semibold text-ink">Итого</span>
          <span className="text-xl font-bold text-ink">{formatUZS(order.total_amount)}</span>
        </div>

      </div>
    </div>
  )
}

// ─── Row helper ───────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border last:border-0">
      <span className="text-xs text-ink-secondary font-medium">{label}</span>
      <span className="text-sm font-semibold text-ink">{value}</span>
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="min-h-screen bg-surface-muted">
      <div className="h-14 bg-surface border-b border-surface-border animate-pulse" />
      <div className="p-4 flex flex-col gap-4">
        <div className="h-32 rounded-2xl bg-surface animate-pulse" />
        <div className="h-48 rounded-2xl bg-surface animate-pulse" />
        <div className="h-16 rounded-2xl bg-surface animate-pulse" />
      </div>
    </div>
  )
}

function BackIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
}
