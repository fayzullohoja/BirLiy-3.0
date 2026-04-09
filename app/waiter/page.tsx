'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppHeader from '@/components/layout/AppHeader'
import PageContainer, { Section, EmptyState } from '@/components/ui/PageContainer'
import Card from '@/components/ui/Card'
import { TableStatusBadge } from '@/components/ui/Badge'
import { useWaiterSession } from './_context/WaiterSessionContext'
import type { Table, TableStatus } from '@/lib/types'

const STATUS_ORDER: TableStatus[] = ['bill_requested', 'occupied', 'reserved', 'free']
const REFRESH_INTERVAL_MS = 15_000
const LIVE_FETCH_OPTIONS: RequestInit = { cache: 'no-store' }

function sortTables(tables: Table[]): Table[] {
  return [...tables].sort(
    (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status),
  )
}

export default function WaiterPage() {
  const session = useWaiterSession()
  const router  = useRouter()

  const [tables, setTables]   = useState<Table[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    if (session.loading || !session.primaryShopId) return
    let cancelled = false

    async function fetchTables(mode: 'initial' | 'refresh' = 'initial') {
      if (mode === 'initial') setLoading(true)

      try {
        const res = await fetch(
          `/api/tables?shop_id=${session.primaryShopId}`,
          LIVE_FETCH_OPTIONS,
        )
        const json = await res.json()

        if (cancelled) return

        if (json.error) {
          if (mode === 'initial') setError(json.error.message)
          return
        }

        setError(null)
        setTables(json.data ?? [])
      } catch {
        if (!cancelled && mode === 'initial') {
          setError('Не удалось загрузить столы')
        }
      } finally {
        if (!cancelled && mode === 'initial') {
          setLoading(false)
        }
      }
    }

    void fetchTables('initial')

    const refresh = () => { void fetchTables('refresh') }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refresh()
    }

    const intervalId = window.setInterval(refresh, REFRESH_INTERVAL_MS)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [session.loading, session.primaryShopId])

  const sorted       = sortTables(tables)
  const occupiedCount = sorted.filter(t => t.status === 'occupied' || t.status === 'bill_requested').length
  const freeCount     = sorted.filter(t => t.status === 'free').length

  return (
    <>
      <AppHeader
        title="BirLiy Kassa"
        subtitle="Официант"
      />

      <PageContainer>
        {/* Summary strip */}
        <div className="flex gap-3 px-4 pt-4 pb-2">
          <SummaryChip label="Занято"   value={occupiedCount} color="warning" />
          <SummaryChip label="Свободно" value={freeCount}     color="success" />
          <SummaryChip label="Всего"    value={sorted.length} color="neutral" />
        </div>

        <Section className="pt-2 pb-6">
          {loading || session.loading ? (
            <TablesSkeleton />
          ) : error ? (
            <EmptyState
              title="Ошибка загрузки"
              description={error}
            />
          ) : sorted.length === 0 ? (
            <EmptyState
              title="Нет столов"
              description="Столы ещё не добавлены"
            />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {sorted.map(table => (
                <TableCard
                  key={table.id}
                  table={table}
                  onClick={() => router.push(`/waiter/table/${table.id}`)}
                />
              ))}
            </div>
          )}
        </Section>
      </PageContainer>
    </>
  )
}

// ─── Table Card ───────────────────────────────────────────────────────────────

function TableCard({ table, onClick }: { table: Table; onClick: () => void }) {
  const isBusy = table.status === 'occupied' || table.status === 'bill_requested'

  return (
    <Card
      className={
        table.status === 'bill_requested'
          ? 'border-red-200 bg-red-50 active:scale-95 transition-transform cursor-pointer'
          : table.status === 'free'
          ? 'border-green-200 active:scale-95 transition-transform cursor-pointer'
          : 'active:scale-95 transition-transform cursor-pointer'
      }
      onClick={onClick}
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-lg font-bold text-ink leading-tight">{table.name}</p>
            <p className="text-xs text-ink-muted">{table.capacity} мест</p>
          </div>
          {isBusy && (
            <span
              className={
                table.status === 'bill_requested'
                  ? 'w-2.5 h-2.5 rounded-full bg-danger animate-pulse-ring mt-1'
                  : 'w-2.5 h-2.5 rounded-full bg-warning mt-1'
              }
              aria-hidden
            />
          )}
        </div>
        <TableStatusBadge status={table.status} />
      </div>
    </Card>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function TablesSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-24 rounded-2xl bg-surface-muted animate-pulse" />
      ))}
    </div>
  )
}

// ─── Summary chip ─────────────────────────────────────────────────────────────

function SummaryChip({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: 'warning' | 'success' | 'neutral'
}) {
  const colors = {
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    success: 'bg-green-50 text-green-700 border-green-200',
    neutral: 'bg-surface-muted text-ink-secondary border-surface-border',
  }

  return (
    <div className={`flex-1 flex flex-col items-center py-2 rounded-2xl border text-center ${colors[color]}`}>
      <span className="text-xl font-bold leading-tight">{value}</span>
      <span className="text-xs font-medium">{label}</span>
    </div>
  )
}
