'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import DataTable, { type ColumnDef } from '@/components/dashboard/DataTable'
import { OrderItemStatusBadge, OrderStatusBadge } from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Card, { CardSection } from '@/components/ui/Card'
import { formatDate, formatTime, formatUZS, PAYMENT_TYPE_LABELS } from '@/lib/utils'
import type { Order, OrderItem } from '@/lib/types'

export default function DashboardOwnerOrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/orders/${id}`, { cache: 'no-store' }).then((result) => result.json())
        if (cancelled) return
        if (response.error) {
          setError(response.error.message)
          return
        }
        setOrder(response.data)
      } catch {
        if (!cancelled) setError('Не удалось загрузить заказ.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [id])

  const columns = useMemo<ColumnDef<OrderItem>[]>(() => [
    {
      key: 'menu_item_id',
      header: 'Позиция',
      render: (row) => (
        <div>
          <p className="font-medium text-ink">{row.menu_item?.name ?? 'Позиция без названия'}</p>
          {row.notes && <p className="text-xs text-ink-secondary">{row.notes}</p>}
        </div>
      ),
    },
    {
      key: 'quantity',
      header: 'Кол-во',
      width: '100px',
      sortable: true,
      render: (row) => row.quantity,
    },
    {
      key: 'unit_price',
      header: 'Цена',
      width: '140px',
      sortable: true,
      render: (row) => formatUZS(row.unit_price),
    },
    {
      key: 'line_total',
      header: 'Сумма',
      width: '150px',
      render: (row) => formatUZS(row.quantity * row.unit_price),
    },
    {
      key: 'status',
      header: 'Статус',
      width: '140px',
      sortable: true,
      render: (row) => <OrderItemStatusBadge status={row.status} />,
    },
  ], [])

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="h-12 w-56 animate-pulse rounded-2xl bg-surface-muted" />
        <div className="grid gap-6 xl:grid-cols-[1.2fr_1.8fr]">
          <div className="h-64 animate-pulse rounded-3xl bg-surface-muted" />
          <div className="h-80 animate-pulse rounded-3xl bg-surface-muted" />
        </div>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 rounded-3xl border border-danger/20 bg-danger/5 p-6">
        <h1 className="text-2xl font-bold text-danger">Не удалось открыть заказ</h1>
        <p className="text-sm text-ink-secondary">{error ?? 'Заказ не найден'}</p>
        <div>
          <Button size="sm" onClick={() => router.push('/dashboard/owner/orders')}>
            К списку заказов
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <button
            type="button"
            onClick={() => router.push('/dashboard/owner/orders')}
            className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            <BackIcon />
            Назад к заказам
          </button>
          <h1 className="text-3xl font-bold text-ink">Заказ #{order.id.slice(-6).toUpperCase()}</h1>
          <p className="mt-2 text-sm text-ink-secondary">
            Создан {formatDate(order.created_at)} в {formatTime(order.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <OrderStatusBadge status={order.status} />
          <Button
            size="sm"
            variant="secondary"
            onClick={() => window.open(`/receipt/${order.id}`, '_blank', 'noopener,noreferrer')}
          >
            <span className="flex items-center gap-1.5">
              <ReceiptIcon />
              Чек
            </span>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1.9fr]">
        <div className="space-y-6">
          <CardSection title="Метаданные">
            <div className="divide-y divide-surface-border">
              <MetaRow label="Стол" value={order.table?.name ?? '—'} />
              <MetaRow label="Официант" value={order.waiter?.name ?? '—'} />
              <MetaRow label="Создан" value={`${formatDate(order.created_at)} · ${formatTime(order.created_at)}`} />
              <MetaRow label="Обновлён" value={`${formatDate(order.updated_at)} · ${formatTime(order.updated_at)}`} />
              <MetaRow label="Оплата" value={order.payment_type ? PAYMENT_TYPE_LABELS[order.payment_type] : '—'} />
            </div>
          </CardSection>

          <Card className="rounded-3xl">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">Итого</p>
                <p className="mt-2 text-3xl font-bold text-ink">{formatUZS(order.total_amount)}</p>
              </div>
              <div className="rounded-2xl bg-surface-muted px-4 py-3 text-right">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">Позиций</p>
                <p className="mt-1 text-xl font-bold text-ink">{order.items?.length ?? 0}</p>
              </div>
            </div>
          </Card>

          {order.notes && (
            <CardSection title="Заметки">
              <div className="p-4 text-sm text-ink-secondary">{order.notes}</div>
            </CardSection>
          )}
        </div>

        <CardSection title="Позиции заказа">
          <DataTable
            columns={columns}
            data={order.items ?? []}
            keyField="id"
            emptyText="В заказе нет позиций"
            pageSize={20}
          />
        </CardSection>
      </div>
    </div>
  )
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <span className="text-sm text-ink-secondary">{label}</span>
      <span className="text-sm font-semibold text-ink">{value}</span>
    </div>
  )
}

function BackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </svg>
  )
}

function ReceiptIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 2v20l3-3 3 3 3-3 3 3 3-3V2z" />
      <line x1="9" y1="9" x2="15" y2="9" />
      <line x1="9" y1="13" x2="15" y2="13" />
      <line x1="9" y1="17" x2="12" y2="17" />
    </svg>
  )
}
