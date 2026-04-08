'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppHeader from '@/components/layout/AppHeader'
import PageContainer, { Section, EmptyState } from '@/components/ui/PageContainer'
import { OrderStatusBadge } from '@/components/ui/Badge'
import { formatUZS, formatTime, PAYMENT_TYPE_LABELS } from '@/lib/utils'
import { useOwnerSession } from '../_context/OwnerSessionContext'
import type { Order } from '@/lib/types'

// ─── Filters ──────────────────────────────────────────────────────────────────

type FilterMode = 'active' | 'today' | 'all'

const FILTER_LABELS: Record<FilterMode, string> = {
  active: 'Активные',
  today:  'Сегодня',
  all:    'История',
}

function todayStr() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tashkent' })
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OwnerOrdersPage() {
  const session = useOwnerSession()
  const router  = useRouter()

  const [orders, setOrders]   = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [filter, setFilter]   = useState<FilterMode>('active')

  const fetchOrders = useCallback(() => {
    if (session.loading) return
    setLoading(true)

    let url = `/api/orders?shop_id=${session.primaryShopId}`
    if (filter === 'active') url += '&status=open,in_kitchen,ready'
    else if (filter === 'today') url += `&date=${todayStr()}`

    fetch(url)
      .then(r => r.json())
      .then(res => {
        if (res.error) setError(res.error.message)
        else setOrders(res.data ?? [])
      })
      .catch(() => setError('Не удалось загрузить заказы'))
      .finally(() => setLoading(false))
  }, [session.loading, session.primaryShopId, filter])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  return (
    <>
      <AppHeader title="Заказы" subtitle={loading ? '' : `${orders.length} заказов`} />

      <PageContainer>
        {/* Filter tabs */}
        <div className="flex px-4 pt-4 gap-2 pb-3">
          {(Object.keys(FILTER_LABELS) as FilterMode[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                filter === f ? 'bg-brand-600 text-white' : 'bg-surface text-ink-secondary border border-surface-border'
              }`}
            >
              {FILTER_LABELS[f]}
            </button>
          ))}
        </div>

        <Section className="pb-6">
          {loading || session.loading ? (
            <OrdersSkeleton />
          ) : error ? (
            <EmptyState title="Ошибка" description={error} />
          ) : orders.length === 0 ? (
            <EmptyState
              title="Заказов нет"
              description={
                filter === 'active' ? 'Нет активных заказов' :
                filter === 'today'  ? 'Сегодня заказов не было' :
                'История заказов пуста'
              }
            />
          ) : (
            <div className="space-y-2">
              {orders.map(order => (
                <OrderRow key={order.id} order={order} onClick={() => router.push(`/owner/orders/${order.id}`)} />
              ))}
            </div>
          )}
        </Section>
      </PageContainer>
    </>
  )
}

// ─── Order row ────────────────────────────────────────────────────────────────

function OrderRow({ order, onClick }: { order: Order; onClick: () => void }) {
  const elapsedMin = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000)
  const isActive   = !['paid', 'cancelled'].includes(order.status)

  return (
    <button onClick={onClick} className="w-full text-left active:scale-[0.99] transition-transform">
      <div className="bg-surface rounded-2xl border border-surface-border overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-ink">{order.table?.name ?? 'Стол'}</span>
              <OrderStatusBadge status={order.status} />
            </div>
            <p className="text-xs text-ink-muted mt-0.5">
              {order.waiter?.name ?? '—'} · {formatTime(order.created_at)}
              {isActive ? ` · ${elapsedMin} мин` : ''}
            </p>
          </div>
          <div className="text-right shrink-0 ml-3">
            <p className="text-sm font-bold text-ink">{formatUZS(order.total_amount)}</p>
            {order.payment_type && <p className="text-xs text-ink-muted">{PAYMENT_TYPE_LABELS[order.payment_type]}</p>}
          </div>
        </div>
      </div>
    </button>
  )
}

function OrdersSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-16 rounded-2xl bg-surface animate-pulse border border-surface-border" />
      ))}
    </div>
  )
}
