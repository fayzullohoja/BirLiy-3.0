'use client'

import { useEffect, useMemo, useState } from 'react'
import DataTable, { type ColumnDef } from '@/components/dashboard/DataTable'
import DateRangePicker from '@/components/dashboard/DateRangePicker'
import FilterBar from '@/components/dashboard/FilterBar'
import OnboardingWizard from '@/components/dashboard/OnboardingWizard'
import RevenueChart from '@/components/dashboard/RevenueChart'
import { SkeletonCard, SkeletonStat } from '@/components/dashboard/Skeleton'
import { useDashboardSession } from '@/components/dashboard/DashboardSessionContext'
import { CardSection, StatCard } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { formatUZS, pluralRu } from '@/lib/utils'
import { exportTopItemsCsv, exportWaitersCsv } from '@/lib/export'
import type { ExtendedAnalyticsResponse } from '@/lib/types'
import type { AnalyticsResponse } from '@/app/api/analytics/route'

type RankedTopItem = ExtendedAnalyticsResponse['top_items'][number] & { rank: number }

export default function DashboardOwnerAnalyticsPage() {
  const session = useDashboardSession()
  const [baseStats, setBaseStats] = useState<AnalyticsResponse | null>(null)
  const [extendedStats, setExtendedStats] = useState<ExtendedAnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [from, setFrom] = useState(() => shiftTashkentDays(-6))
  const [to, setTo] = useState(() => tashkentDateInput())

  useEffect(() => {
    if (session.loading) return
    if (!session.selectedShopId) {
      setLoading(false)
      setError('Не удалось определить текущее заведение для аналитики.')
      return
    }

    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const [baseRes, extendedRes] = await Promise.all([
          fetch(`/api/analytics?shop_id=${session.selectedShopId}`, { cache: 'no-store' }).then((response) => response.json()),
          fetch(
            `/api/analytics/extended?shop_id=${session.selectedShopId}&from=${from}&to=${to}`,
            { cache: 'no-store' },
          ).then((response) => response.json()),
        ])

        if (cancelled) return

        if (baseRes.error) {
          setError(baseRes.error.message)
          return
        }

        if (extendedRes.error) {
          setError(extendedRes.error.message)
          return
        }

        setBaseStats(baseRes.data)
        setExtendedStats(extendedRes.data)
      } catch {
        if (!cancelled) setError('Не удалось загрузить аналитику.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [from, session.loading, session.selectedShopId, to])

  const topItems = useMemo<RankedTopItem[]>(
    () => (extendedStats?.top_items ?? []).map((item, index) => ({ ...item, rank: index + 1 })),
    [extendedStats?.top_items],
  )

  const waiterRows = extendedStats?.by_waiter ?? []
  const kpi = baseStats?.today
  const chartData = extendedStats?.by_day ?? []
  const hasOrders = (extendedStats?.period.orders ?? 0) > 0

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      {/* Onboarding wizard — only shows for new shops */}
      {session.selectedShopId && (
        <OnboardingWizard shopId={session.selectedShopId} shopName={session.shopName ?? 'Ваше заведение'} />
      )}

      <section className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-ink">Аналитика</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-secondary">
              Desktop-обзор по выбранному заведению: выручка, активные заказы, динамика по дням и эффективность официантов.
            </p>
          </div>
        </div>
      </section>

      <FilterBar>
        <div className="flex-1">
          <DateRangePicker from={from} to={to} onChange={(nextFrom, nextTo) => {
            setFrom(nextFrom)
            setTo(nextTo)
          }} />
        </div>
        <div className="min-w-[180px] rounded-2xl border border-surface-border bg-surface-muted px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">Контекст</p>
          <p className="mt-2 text-sm font-semibold text-ink">{session.shopName ?? 'Заведение не выбрано'}</p>
          <p className="mt-1 text-xs text-ink-secondary">{from} — {to}</p>
        </div>
      </FilterBar>

      {error ? (
        <ErrorBlock message={error} onRetry={() => window.location.reload()} />
      ) : (
        <>
          <section className="grid gap-4 xl:grid-cols-4 md:grid-cols-2">
            {loading ? (
              Array.from({ length: 4 }).map((_, index) => <SkeletonStat key={index} />)
            ) : (
              <>
                <StatCard
                  label="Выручка"
                  value={formatUZS(extendedStats?.period.revenue ?? 0)}
                  sub={pluralRu(extendedStats?.period.orders ?? 0, 'заказ', 'заказа', 'заказов')}
                  variant="brand"
                  icon={<RevenueIcon />}
                />
                <StatCard
                  label="Заказов"
                  value={String(extendedStats?.period.orders ?? 0)}
                  sub="оплаченных за период"
                  icon={<OrdersIcon />}
                />
                <StatCard
                  label="Средний чек"
                  value={formatUZS(extendedStats?.period.avg_order ?? 0)}
                  sub="по paid-заказам"
                  icon={<ReceiptIcon />}
                />
                <StatCard
                  label="Активных сейчас"
                  value={String(kpi?.open_orders ?? 0)}
                  sub="open / kitchen / ready"
                  icon={<PulseIcon />}
                />
              </>
            )}
          </section>

          <div className="grid gap-6 xl:grid-cols-[1.9fr_1fr]">
            <CardSection
              title="Динамика выручки"
              action={
                !loading && !hasOrders ? (
                  <span className="text-xs text-ink-muted">Нет paid-заказов за период</span>
                ) : null
              }
            >
              <div className="p-4">
                {loading ? (
                  <SkeletonCard className="h-[320px]" />
                ) : (
                  <RevenueChart data={chartData} height={320} />
                )}
              </div>
            </CardSection>

            <CardSection title="Итоги за сегодня">
              <div className="space-y-4 p-4">
                {loading ? (
                  <>
                    <SkeletonCard className="h-24" />
                    <SkeletonCard className="h-24" />
                  </>
                ) : (
                  <>
                    <MiniKpi
                      label="Сегодня оплачено"
                      value={String(kpi?.orders ?? 0)}
                      sub={formatUZS(kpi?.revenue ?? 0)}
                    />
                    <MiniKpi
                      label="Средний чек сегодня"
                      value={formatUZS(kpi?.avg_order ?? 0)}
                      sub={pluralRu(kpi?.open_orders ?? 0, 'активный заказ', 'активных заказа', 'активных заказов')}
                    />
                  </>
                )}
              </div>
            </CardSection>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <CardSection
              title="Топ блюд за период"
              action={
                !loading && topItems.length > 0 ? (
                  <button
                    onClick={() => exportTopItemsCsv(topItems, `top_items_${from}_${to}.csv`)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors"
                  >
                    <ExportIcon />
                    CSV
                  </button>
                ) : null
              }
            >
              <DataTable
                columns={TOP_ITEMS_COLUMNS}
                data={topItems}
                keyField="item_id"
                loading={loading}
                emptyText="Нет продаж по позициям за выбранный период"
                pageSize={10}
              />
            </CardSection>

            <CardSection
              title="Официанты за период"
              action={
                !loading && waiterRows.length > 0 ? (
                  <button
                    onClick={() => exportWaitersCsv(waiterRows, `waiters_${from}_${to}.csv`)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors"
                  >
                    <ExportIcon />
                    CSV
                  </button>
                ) : null
              }
            >
              <DataTable
                columns={WAITER_COLUMNS}
                data={waiterRows}
                keyField="waiter_id"
                loading={loading}
                emptyText="Нет статистики по официантам за выбранный период"
                pageSize={10}
              />
            </CardSection>
          </div>
        </>
      )}
    </div>
  )
}

const TOP_ITEMS_COLUMNS: ColumnDef<RankedTopItem>[] = [
  {
    key: 'rank',
    header: '#',
    width: '60px',
    sortable: true,
    render: (row) => <span className="font-semibold text-ink-secondary">{row.rank}</span>,
  },
  {
    key: 'name',
    header: 'Блюдо',
    sortable: true,
    render: (row) => <span className="font-medium text-ink">{row.name}</span>,
  },
  {
    key: 'quantity',
    header: 'Порций',
    width: '120px',
    sortable: true,
    render: (row) => row.quantity,
  },
  {
    key: 'revenue',
    header: 'Выручка',
    width: '150px',
    sortable: true,
    render: (row) => <span className="font-semibold text-ink">{formatUZS(row.revenue)}</span>,
  },
]

const WAITER_COLUMNS: ColumnDef<ExtendedAnalyticsResponse['by_waiter'][number]>[] = [
  {
    key: 'waiter_name',
    header: 'Официант',
    sortable: true,
    render: (row) => <span className="font-medium text-ink">{row.waiter_name}</span>,
  },
  {
    key: 'orders',
    header: 'Заказов',
    width: '110px',
    sortable: true,
    render: (row) => row.orders,
  },
  {
    key: 'revenue',
    header: 'Выручка',
    width: '150px',
    sortable: true,
    render: (row) => formatUZS(row.revenue),
  },
  {
    key: 'avg_order',
    header: 'Средний чек',
    width: '150px',
    render: (row) => formatUZS(row.orders > 0 ? Math.round(row.revenue / row.orders) : 0),
  },
]

function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-3xl border border-danger/20 bg-danger/5 p-6">
      <h2 className="text-lg font-bold text-danger">Не удалось загрузить аналитику</h2>
      <p className="mt-2 text-sm text-ink-secondary">{message}</p>
      <Button className="mt-4" size="sm" onClick={onRetry}>Повторить</Button>
    </div>
  )
}

function MiniKpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-surface-border bg-surface-muted p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">{label}</p>
      <p className="mt-2 text-2xl font-bold text-ink">{value}</p>
      <p className="mt-1 text-sm text-ink-secondary">{sub}</p>
    </div>
  )
}

function tashkentDateInput(date = new Date()) {
  return date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tashkent' })
}

function shiftTashkentDays(days: number) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + days)
  return tashkentDateInput(date)
}

function RevenueIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19h16" /><path d="m7 14 3-3 3 2 4-5" /><path d="M7 19v-3" /><path d="M10 19v-6" /><path d="M13 19v-4" /><path d="M17 19V8" /></svg>
}

function OrdersIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M9 4H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2" /><rect x="9" y="2" width="6" height="4" rx="1" /><path d="M9 12h6" /><path d="M9 16h4" /></svg>
}

function ReceiptIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16l3-2 3 2 3-2 3 2 3-2V8z" /><path d="M14 2v6h6" /><path d="M10 13h4" /><path d="M10 17h4" /></svg>
}

function PulseIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 7-4-14-3 7H2" /></svg>
}

function ExportIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}
