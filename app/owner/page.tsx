'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppHeader from '@/components/layout/AppHeader'
import PageContainer, { Section } from '@/components/ui/PageContainer'
import { StatCard } from '@/components/ui/Card'
import { toast } from '@/components/ui/Toast'
import { formatUZS, formatDate } from '@/lib/utils'
import { useOwnerSession } from './_context/OwnerSessionContext'
import type { AnalyticsResponse } from '../api/analytics/route'

export default function OwnerDashboardPage() {
  const session = useOwnerSession()
  const router  = useRouter()

  const [stats, setStats]           = useState<AnalyticsResponse | null>(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [openingDash, setOpeningDash] = useState(false)

  useEffect(() => {
    if (session.loading) return
    let cancelled = false

    fetch(`/api/analytics?shop_id=${session.primaryShopId}`)
      .then(r => r.json())
      .then(res => {
        if (cancelled) return
        if (res.error) setError(res.error.message)
        else setStats(res.data)
      })
      .catch(() => { if (!cancelled) setError('Не удалось загрузить статистику') })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [session.loading, session.primaryShopId])

  const today   = stats?.today
  const days    = stats?.last7days ?? []
  const waiters = stats?.waiters ?? []

  async function openDashboard() {
    setOpeningDash(true)
    try {
      const res  = await fetch('/api/auth/magic', { method: 'POST' })
      const json = await res.json()
      if (json.error) {
        toast.error(json.error.message ?? 'Не удалось открыть веб-панель')
        return
      }
      const url = json.data?.url
      if (url) {
        window.location.assign(url)
      }
    } catch {
      toast.error('Не удалось открыть веб-панель')
    } finally {
      setOpeningDash(false)
    }
  }

  return (
    <>
      <AppHeader title="BirLiy Kassa" subtitle="Владелец" />

      <PageContainer>
        <div className="px-4 pt-4 pb-2">
          <p className="section-label">Сегодня — {formatDate(new Date().toISOString())}</p>
        </div>

        {/* Primary stats */}
        <Section className="pb-4">
          {loading || session.loading ? (
            <StatsSkeleton />
          ) : error ? (
            <div className="text-center py-6 text-sm text-danger">{error}</div>
          ) : (
            <div className="space-y-3">
              <StatCard
                label="Выручка за день"
                value={formatUZS(today?.revenue ?? 0)}
                sub={`${today?.orders ?? 0} заказов оплачено`}
                variant="brand"
                icon={<MoneyIcon />}
              />
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  label="Средний чек"
                  value={formatUZS(today?.avg_order ?? 0)}
                  icon={<ReceiptIcon />}
                />
                <StatCard
                  label="Открытых"
                  value={String(today?.open_orders ?? 0)}
                  sub="активных заказов"
                  icon={<CartIcon />}
                />
              </div>
            </div>
          )}
        </Section>

        {/* Quick nav tiles */}
        <Section className="pb-4">
          <div className="grid grid-cols-2 gap-3">
            <QuickTile label="Управление столами" icon={<TableIcon />}  onClick={() => router.push('/owner/tables')}   color="green"  />
            <QuickTile label="Бронирования"        icon={<BookingIcon />} onClick={() => router.push('/owner/bookings')} color="blue"   />
            <QuickTile label="История заказов"     icon={<HistoryIcon />} onClick={() => router.push('/owner/orders')}  color="amber"  />
            <QuickTile label="Кухня"               icon={<KitchenIcon />} onClick={() => router.push('/kitchen')}       color="orange" />
            <QuickTile label="Персонал"             icon={<StaffIcon />}   onClick={() => router.push('/owner/staff')}   color="purple" />
            <QuickTile label="Веб-панель"           icon={<DashboardIcon />} onClick={openDashboard} color="teal" loading={openingDash} />
          </div>
        </Section>

        {/* Last 7 days */}
        {!loading && days.length > 0 && (
          <Section title="Последние 7 дней" className="pb-4">
            <div className="card overflow-hidden">
              <div className="divide-y divide-surface-border">
                {days.map((day, i) => (
                  <div key={day.date} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className={`text-sm font-semibold ${i === 0 ? 'text-brand-600' : 'text-ink'}`}>
                        {i === 0 ? 'Сегодня' : i === 1 ? 'Вчера' : formatDate(`${day.date}T00:00:00Z`)}
                      </p>
                      <p className="text-xs text-ink-muted">{day.orders} заказ.</p>
                    </div>
                    <span className={`text-sm font-bold ${i === 0 ? 'text-brand-600' : 'text-ink'}`}>
                      {formatUZS(day.revenue)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Section>
        )}

        {/* Waiter summary */}
        {!loading && waiters.length > 0 && (
          <Section title="Официанты сегодня" className="pb-6">
            <div className="card overflow-hidden">
              <div className="divide-y divide-surface-border">
                {waiters.map(w => (
                  <div key={w.waiter_id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-brand-700">
                          {w.waiter_name.slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-ink">{w.waiter_name}</p>
                        <p className="text-xs text-ink-muted">{w.orders} заказ.</p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-ink">{formatUZS(w.revenue)}</span>
                  </div>
                ))}
              </div>
            </div>
          </Section>
        )}

        {!loading && waiters.length === 0 && !error && (
          <div className="px-4 pb-6 text-center">
            <p className="text-sm text-ink-muted">Оплаченных заказов сегодня нет</p>
          </div>
        )}
      </PageContainer>
    </>
  )
}

// ─── Quick nav tile ───────────────────────────────────────────────────────────

function QuickTile({ label, icon, onClick, color, loading }: {
  label: string; icon: React.ReactNode; onClick: () => void; color: string; loading?: boolean
}) {
  const styles: Record<string, string> = {
    green:  'bg-green-50  border-green-200  text-green-700',
    blue:   'bg-blue-50   border-blue-200   text-blue-700',
    amber:  'bg-amber-50  border-amber-200  text-amber-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    teal:   'bg-teal-50   border-teal-200   text-teal-700',
  }
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`flex flex-col items-start gap-3 p-4 rounded-2xl border ${styles[color]} active:scale-95 transition-transform disabled:opacity-60`}
    >
      <span className="opacity-80">{loading ? <SpinnerIcon /> : icon}</span>
      <span className="text-sm font-semibold leading-tight text-left">{label}</span>
    </button>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function StatsSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-24 rounded-2xl bg-surface animate-pulse" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-20 rounded-2xl bg-surface animate-pulse" />
        <div className="h-20 rounded-2xl bg-surface animate-pulse" />
      </div>
    </div>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function MoneyIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>
}
function ReceiptIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="9" y1="13" x2="15" y2="13" /><line x1="9" y1="17" x2="13" y2="17" /></svg>
}
function CartIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></svg>
}
function TableIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="12" rx="2" /><path d="M9 15v6M15 15v6M6 21h12" /></svg>
}
function BookingIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
}
function HistoryIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="12 8 12 12 14 14" /><path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5" /></svg>
}
function KitchenIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 11a5 5 0 0 1 10 0" /><path d="M4 11h16v2a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z" /><path d="M9 16v4M15 16v4" /><path d="M12 3v2" /></svg>
}
function StaffIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
}
function DashboardIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
}
function SpinnerIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
}
