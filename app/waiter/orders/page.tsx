'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppHeader from '@/components/layout/AppHeader'
import PageContainer, { Section, EmptyState } from '@/components/ui/PageContainer'
import { CardSection, ListItem } from '@/components/ui/Card'
import { OrderStatusBadge } from '@/components/ui/Badge'
import { formatUZS, formatTime } from '@/lib/utils'
import { useWaiterSession } from '../_context/WaiterSessionContext'
import type { Order } from '@/lib/types'

export default function WaiterOrdersPage() {
  const session = useWaiterSession()
  const router  = useRouter()

  const [orders, setOrders]   = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    if (session.loading) return
    let cancelled = false

    setLoading(true)
    fetch(
      `/api/orders?shop_id=${session.primaryShopId}&status=open,in_kitchen,ready`,
    )
      .then(r => r.json())
      .then(res => {
        if (cancelled) return
        if (res.error) {
          setError(res.error.message)
        } else {
          setOrders(res.data ?? [])
        }
      })
      .catch(() => { if (!cancelled) setError('Не удалось загрузить заказы') })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [session.loading, session.primaryShopId])

  return (
    <>
      <AppHeader
        title="Мои заказы"
        subtitle={loading ? '...' : `Активных: ${orders.length}`}
      />

      <PageContainer>
        <Section className="pt-4 pb-6 space-y-3">
          {loading || session.loading ? (
            <OrdersSkeleton />
          ) : error ? (
            <EmptyState title="Ошибка" description={error} />
          ) : orders.length === 0 ? (
            <EmptyState
              title="Нет активных заказов"
              description="Создайте заказ из раздела «Столы»"
            />
          ) : (
            orders.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                onClick={() =>
                  router.push(`/waiter/table/${order.table_id}`)
                }
              />
            ))
          )}
        </Section>
      </PageContainer>
    </>
  )
}

// ─── Order Card ───────────────────────────────────────────────────────────────

function OrderCard({ order, onClick }: { order: Order; onClick: () => void }) {
  const elapsedMin = Math.floor(
    (Date.now() - new Date(order.created_at).getTime()) / 60000,
  )

  return (
    <button
      className="w-full text-left active:scale-[0.99] transition-transform"
      onClick={onClick}
    >
      <CardSection>
        <ListItem
          title={order.table?.name ?? `Стол ${order.table_id}`}
          subtitle={`Открыт в ${formatTime(order.created_at)} · ${elapsedMin} мин`}
          trailing={<OrderStatusBadge status={order.status} />}
        />
        <div className="flex items-center justify-between px-4 py-3 border-t border-surface-border bg-surface-muted">
          <span className="text-sm text-ink-secondary">
            {order.items ? `${order.items.length} позиц.` : 'Итого'}
          </span>
          <span className="text-base font-bold text-ink">{formatUZS(order.total_amount)}</span>
        </div>
      </CardSection>
    </button>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function OrdersSkeleton() {
  return (
    <>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-2xl bg-surface border border-surface-border overflow-hidden animate-pulse">
          <div className="h-16 bg-surface-muted" />
          <div className="h-10 bg-surface border-t border-surface-border" />
        </div>
      ))}
    </>
  )
}
