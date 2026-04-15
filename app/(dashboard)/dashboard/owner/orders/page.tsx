'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import DataTable, { type ColumnDef } from '@/components/dashboard/DataTable'
import DateRangePicker from '@/components/dashboard/DateRangePicker'
import FilterBar from '@/components/dashboard/FilterBar'
import FilterChip from '@/components/dashboard/FilterChip'
import SearchInput from '@/components/dashboard/SearchInput'
import { useDashboardSession } from '@/components/dashboard/DashboardSessionContext'
import { OrderStatusBadge } from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { formatDate, formatTime, formatUZS } from '@/lib/utils'
import { exportOrdersCsv } from '@/lib/export'
import type { Order } from '@/lib/types'

type StatusFilter = 'all' | 'active' | 'paid' | 'cancelled'

const STATUS_FILTERS: Array<{ key: StatusFilter; label: string }> = [
  { key: 'all', label: 'Все' },
  { key: 'active', label: 'Активные' },
  { key: 'paid', label: 'Оплачено' },
  { key: 'cancelled', label: 'Отменено' },
]

export default function DashboardOwnerOrdersPage() {
  const session = useDashboardSession()
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState(() => shiftTashkentDays(-29))
  const [to, setTo] = useState(() => tashkentDateInput())

  useEffect(() => {
    if (session.loading) return
    if (!session.selectedShopId) {
      setLoading(false)
      setError('Не удалось определить текущее заведение.')
      return
    }

    const shopId = session.selectedShopId
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const url = new URL('/api/orders', window.location.origin)
        url.searchParams.set('shop_id', shopId)
        const statusParam = resolveStatusFilter(statusFilter)
        if (statusParam) url.searchParams.set('status', statusParam)

        const response = await fetch(url.toString(), { cache: 'no-store' }).then((result) => result.json())
        if (cancelled) return

        if (response.error) {
          setError(response.error.message)
          return
        }

        setOrders(response.data ?? [])
      } catch {
        if (!cancelled) setError('Не удалось загрузить заказы.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [session.loading, session.selectedShopId, statusFilter])

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const orderDay = new Date(order.created_at).toLocaleDateString('sv-SE', { timeZone: 'Asia/Tashkent' })
      const inRange = orderDay >= from && orderDay <= to
      if (!inRange) return false

      if (!search.trim()) return true
      return order.id.slice(-6).toUpperCase().includes(search.trim().toUpperCase())
    })
  }, [from, orders, search, to])

  const columns = useMemo<ColumnDef<Order>[]>(() => [
    {
      key: 'id',
      header: '#',
      width: '90px',
      sortable: true,
      render: (row) => <span className="font-mono text-xs font-semibold uppercase text-ink">{row.id.slice(-6)}</span>,
    },
    {
      key: 'table',
      header: 'Стол',
      width: '120px',
      render: (row) => row.table?.name ?? '—',
    },
    {
      key: 'waiter',
      header: 'Официант',
      width: '180px',
      render: (row) => row.waiter?.name ?? '—',
    },
    {
      key: 'total_amount',
      header: 'Сумма',
      width: '160px',
      sortable: true,
      render: (row) => <span className="font-semibold text-ink">{formatUZS(row.total_amount)}</span>,
    },
    {
      key: 'status',
      header: 'Статус',
      width: '150px',
      sortable: true,
      render: (row) => <OrderStatusBadge status={row.status} />,
    },
    {
      key: 'items_count',
      header: 'Позиций',
      width: '110px',
      render: (row) => row.items?.length ?? 0,
    },
    {
      key: 'created_at',
      header: 'Создан',
      width: '170px',
      sortable: true,
      render: (row) => (
        <div>
          <p className="font-medium text-ink">{formatDate(row.created_at)}</p>
          <p className="text-xs text-ink-secondary">{formatTime(row.created_at)}</p>
        </div>
      ),
    },
  ], [])

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <section>
        <h1 className="text-3xl font-bold text-ink">Заказы</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-secondary">
          История и активные заказы по выбранному заведению с фильтрами по статусу, периоду и быстрому поиску по номеру заказа.
        </p>
      </section>

      <FilterBar>
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((filter) => (
              <FilterChip
                key={filter.key}
                label={filter.label}
                active={statusFilter === filter.key}
                onClick={() => setStatusFilter(filter.key)}
              />
            ))}
          </div>
          <DateRangePicker from={from} to={to} onChange={(nextFrom, nextTo) => {
            setFrom(nextFrom)
            setTo(nextTo)
          }} />
        </div>

        <div className="w-full max-w-sm space-y-3">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Поиск по номеру заказа"
          />
          <div className="flex items-center gap-3">
            <div className="flex-1 rounded-2xl border border-surface-border bg-surface-muted px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">Результат</p>
              <p className="mt-1 text-sm font-semibold text-ink">
                {filteredOrders.length} {pluralizeOrders(filteredOrders.length)} · {session.shopName ?? 'Заведение не выбрано'}
              </p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              disabled={filteredOrders.length === 0 || loading}
              onClick={() => exportOrdersCsv(filteredOrders, `orders_${from}_${to}.csv`)}
            >
              <span className="flex items-center gap-1.5">
                <ExportIcon />
                CSV
              </span>
            </Button>
          </div>
        </div>
      </FilterBar>

      {error ? (
        <div className="rounded-3xl border border-danger/20 bg-danger/5 p-6">
          <h2 className="text-lg font-bold text-danger">Не удалось загрузить заказы</h2>
          <p className="mt-2 text-sm text-ink-secondary">{error}</p>
          <Button className="mt-4" size="sm" onClick={() => window.location.reload()}>
            Повторить
          </Button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filteredOrders}
          keyField="id"
          loading={loading}
          emptyText="По текущим фильтрам заказы не найдены"
          onRowClick={(row) => router.push(`/dashboard/owner/orders/${row.id}`)}
          pageSize={20}
        />
      )}
    </div>
  )
}

function resolveStatusFilter(filter: StatusFilter) {
  if (filter === 'active') return 'open,in_kitchen,ready'
  if (filter === 'paid') return 'paid'
  if (filter === 'cancelled') return 'cancelled'
  return ''
}

function pluralizeOrders(count: number) {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return 'заказ'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'заказа'
  return 'заказов'
}

function tashkentDateInput(date = new Date()) {
  return date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tashkent' })
}

function shiftTashkentDays(days: number) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + days)
  return tashkentDateInput(date)
}

function ExportIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}
