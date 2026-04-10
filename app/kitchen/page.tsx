'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import AppHeader, { HeaderIconButton } from '@/components/layout/AppHeader'
import PageContainer, { EmptyState, Section } from '@/components/ui/PageContainer'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { OrderStatusBadge } from '@/components/ui/Badge'
import { toast } from '@/components/ui/Toast'
import { formatTime, pluralRu } from '@/lib/utils'
import { useKitchenSession } from './_context/KitchenSessionContext'
import type { ApiResponse, Order, OrderItem } from '@/lib/types'

const REFRESH_INTERVAL_MS = 15_000
const LIVE_FETCH_OPTIONS: RequestInit = { cache: 'no-store' }

export default function KitchenPage() {
  const session = useKitchenSession()

  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const fetchOrders = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (session.loading || !session.primaryShopId) return

    if (mode === 'initial') setLoading(true)
    if (mode === 'refresh') setRefreshing(true)

    try {
      const res = await fetch(
        `/api/orders?shop_id=${session.primaryShopId}&status=in_kitchen`,
        LIVE_FETCH_OPTIONS,
      )
      const json: ApiResponse<Order[]> = await res.json()
      if (json.error) {
        if (mode === 'initial') setError(json.error.message)
        return
      }
      setError(null)
      const queue = (json.data ?? [])
        .map((order) => ({
          ...order,
          items: (order.items ?? []).filter((item) => item.status === 'in_kitchen'),
        }))
        .filter((order) => (order.items?.length ?? 0) > 0)
      setOrders(queue)
    } catch {
      if (mode === 'initial') setError('Не удалось загрузить очередь кухни')
    } finally {
      if (mode === 'initial') setLoading(false)
      if (mode === 'refresh') setRefreshing(false)
    }
  }, [session.loading, session.primaryShopId])

  useEffect(() => {
    if (session.loading || !session.primaryShopId) return

    void fetchOrders('initial')
    const refresh = () => { void fetchOrders('refresh') }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refresh()
    }

    const intervalId = window.setInterval(refresh, REFRESH_INTERVAL_MS)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [fetchOrders, session.loading, session.primaryShopId])

  const summary = useMemo(() => {
    const itemCount = orders.reduce((sum, order) => (
      sum + (order.items?.reduce((itemSum, item) => itemSum + item.quantity, 0) ?? 0)
    ), 0)
    const elapsed = orders.map(order => getElapsedMinutes(getKitchenBatchStartedAt(order)))
    const overdue = elapsed.filter(min => min >= 20).length
    const avgWait = elapsed.length > 0
      ? Math.round(elapsed.reduce((sum, min) => sum + min, 0) / elapsed.length)
      : 0

    return { itemCount, overdue, avgWait }
  }, [orders])

  const queueOrders = useMemo(() => (
    [...orders].sort(
      (a, b) => new Date(getKitchenBatchStartedAt(a)).getTime() - new Date(getKitchenBatchStartedAt(b)).getTime(),
    )
  ), [orders])

  async function handleReady(orderId: string) {
    setUpdatingId(orderId)
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ready' }),
      })
      const json: ApiResponse<Order> = await res.json()
      if (json.error) {
        toast.error(json.error.message)
        return
      }

      setOrders(prev => prev.filter(order => order.id !== orderId))
      toast.success('Заказ отмечен как готовый')
    } catch {
      toast.error('Не удалось обновить статус заказа')
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <>
      <AppHeader
        title="BirLiy Kassa"
        subtitle={session.shopName ? `Кухня · ${session.shopName}` : 'Кухня'}
        rightSlot={(
          <HeaderIconButton
            label="Обновить очередь"
            onClick={() => fetchOrders('refresh')}
            className={refreshing ? 'animate-spin' : undefined}
          >
            <RefreshIcon />
          </HeaderIconButton>
        )}
      />

      <PageContainer>
        <div className="flex gap-3 px-4 pt-4 pb-2">
          <SummaryChip label="В очереди" value={orders.length} tone="warning" />
          <SummaryChip label="Позиций" value={summary.itemCount} tone="neutral" />
          <SummaryChip label="Среднее" value={summary.avgWait} suffix=" мин" tone="danger" />
        </div>

        {summary.overdue > 0 && !loading && (
          <div className="mx-4 mt-1 mb-1 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm font-semibold text-amber-800">
              {pluralRu(summary.overdue, 'заказ ждёт дольше 20 минут', 'заказа ждут дольше 20 минут', 'заказов ждут дольше 20 минут')}
            </p>
          </div>
        )}

        <Section className="pt-2 pb-6">
          {loading || session.loading ? (
            <KitchenSkeleton />
          ) : error ? (
            <EmptyState
              title="Не удалось открыть кухню"
              description={error}
              action={(
                <Button variant="secondary" size="sm" onClick={() => fetchOrders('initial')}>
                  Повторить
                </Button>
              )}
            />
          ) : queueOrders.length === 0 ? (
            <EmptyState
              icon={<ChefIcon />}
              title="Очередь пуста"
              description="Новых заказов на кухне сейчас нет"
            />
          ) : (
            <div className="space-y-3">
              {queueOrders.map(order => (
                <KitchenOrderCard
                  key={order.id}
                  order={order}
                  loading={updatingId === order.id}
                  onReady={() => handleReady(order.id)}
                />
              ))}
            </div>
          )}
        </Section>
      </PageContainer>
    </>
  )
}

function KitchenOrderCard({
  order,
  loading,
  onReady,
}: {
  order: Order
  loading: boolean
  onReady: () => void
}) {
  const elapsed = getElapsedMinutes(getKitchenBatchStartedAt(order))
  const urgent = elapsed >= 20
  const queueItems = order.items ?? []
  const itemCount = queueItems.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <Card className={urgent ? 'border-amber-300 bg-amber-50/40' : undefined}>
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-lg font-bold text-ink leading-tight">
                {order.table?.name ?? 'Стол'}
              </p>
              <OrderStatusBadge status={order.status} />
              <TimePill elapsed={elapsed} urgent={urgent} />
            </div>
            <p className="text-sm text-ink-secondary mt-1">
              {order.waiter?.name ?? 'Без официанта'} · {pluralRu(itemCount, 'позиция', 'позиции', 'позиций')} · {formatTime(getKitchenBatchStartedAt(order))}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Стол</p>
            <p className="text-lg font-bold text-ink">
              {order.table?.number ?? '—'}
            </p>
          </div>
        </div>

        {order.notes && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 mb-1">
              Комментарий к заказу
            </p>
            <p className="text-sm text-amber-900">{order.notes}</p>
          </div>
        )}

        <div className="rounded-2xl border border-surface-border overflow-hidden bg-surface">
          <div className="flex items-center justify-between px-3 py-2 border-b border-surface-border">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">
              Позиции
            </span>
            <span className="text-xs text-ink-muted">
              {pluralRu(itemCount, 'порция', 'порции', 'порций')}
            </span>
          </div>
          <div className="divide-y divide-surface-border">
            {queueItems.map(item => (
              <KitchenItemRow key={item.id} item={item} />
            ))}
          </div>
        </div>

        <Button fullWidth loading={loading} onClick={onReady}>
          Готово
        </Button>
      </div>
    </Card>
  )
}

function KitchenItemRow({ item }: { item: OrderItem }) {
  return (
    <div className="px-3 py-3">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center text-sm font-bold shrink-0">
          {item.quantity}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">
            {item.menu_item?.name ?? 'Позиция'}
          </p>
          {item.notes && (
            <p className="text-xs text-ink-secondary mt-1">{item.notes}</p>
          )}
        </div>
      </div>
    </div>
  )
}

function SummaryChip({
  label,
  value,
  suffix,
  tone,
}: {
  label: string
  value: number
  suffix?: string
  tone: 'warning' | 'danger' | 'neutral'
}) {
  const colors = {
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    danger: 'bg-red-50 text-red-700 border-red-200',
    neutral: 'bg-surface-muted text-ink-secondary border-surface-border',
  }

  return (
    <div className={`flex-1 flex flex-col items-center py-2 rounded-2xl border text-center ${colors[tone]}`}>
      <span className="text-xl font-bold leading-tight">
        {value}
        {suffix ?? ''}
      </span>
      <span className="text-xs font-medium">{label}</span>
    </div>
  )
}

function TimePill({ elapsed, urgent }: { elapsed: number; urgent: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
        urgent ? 'bg-red-100 text-red-700' : 'bg-surface-muted text-ink-secondary'
      }`}
    >
      {elapsed} мин
    </span>
  )
}

function KitchenSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="h-64 rounded-2xl bg-surface animate-pulse border border-surface-border"
        />
      ))}
    </div>
  )
}

function getElapsedMinutes(iso: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000))
}

function getKitchenBatchStartedAt(order: Order) {
  const timestamps = (order.items ?? [])
    .map((item) => item.sent_to_kitchen_at ?? item.created_at)
    .filter(Boolean)

  return timestamps.sort()[0] ?? order.updated_at ?? order.created_at
}

function RefreshIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 0 1 15.55-6.36L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15.55 6.36L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  )
}

function ChefIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 11a4 4 0 1 1 8 0" />
      <path d="M5 11h14v2a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z" />
      <path d="M9 15v3" />
      <path d="M15 15v3" />
      <path d="M10 7.2A2.2 2.2 0 0 1 12 4a2.2 2.2 0 0 1 2 3.2" />
    </svg>
  )
}
