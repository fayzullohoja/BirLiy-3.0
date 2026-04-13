'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import { CardSection, StatCard } from '@/components/ui/Card'
import FilterBar from '@/components/dashboard/FilterBar'
import FilterChip from '@/components/dashboard/FilterChip'
import { SkeletonCard, SkeletonStat } from '@/components/dashboard/Skeleton'
import SubscriptionTimelineChart from '@/components/dashboard/SubscriptionTimelineChart'
import { normalizeAdminShopRecords, daysLeft, type AdminShopRecord } from '@/lib/dashboard/adminShopUtils'
import { formatDate } from '@/lib/utils'
import type { StatsTimelineResponse } from '@/lib/types'

interface PlatformStatsResponse {
  shops: number
  users: number
  subscriptions: {
    trial: number
    active: number
    expired: number
    suspended: number
  }
  today_orders: number
}

const DAY_OPTIONS = [14, 30, 90] as const

export default function DashboardAdminOverviewPage() {
  const router = useRouter()
  const [stats, setStats] = useState<PlatformStatsResponse | null>(null)
  const [timeline, setTimeline] = useState<StatsTimelineResponse | null>(null)
  const [shops, setShops] = useState<AdminShopRecord[]>([])
  const [days, setDays] = useState<(typeof DAY_OPTIONS)[number]>(30)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const [statsRes, timelineRes, shopsRes] = await Promise.all([
          fetch('/api/admin/stats', { cache: 'no-store' }).then((response) => response.json()),
          fetch(`/api/admin/stats/timeline?days=${days}`, { cache: 'no-store' }).then((response) => response.json()),
          fetch('/api/admin/shops', { cache: 'no-store' }).then((response) => response.json()),
        ])

        if (cancelled) return

        if (statsRes.error) {
          setError(statsRes.error.message)
          return
        }
        if (timelineRes.error) {
          setError(timelineRes.error.message)
          return
        }
        if (shopsRes.error) {
          setError(shopsRes.error.message)
          return
        }

        setStats(statsRes.data)
        setTimeline(timelineRes.data)
        setShops(shopsRes.data ?? [])
      } catch {
        if (!cancelled) setError('Не удалось загрузить обзор платформы')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [days])

  const normalizedShops = useMemo(() => normalizeAdminShopRecords(shops), [shops])

  const chartData = useMemo(() => {
    const source = timeline?.subscriptions_by_day ?? []
    const counts = new Map<string, { trial: number; starter: number; pro: number }>()

    for (const point of source) {
      const bucket = counts.get(point.date) ?? { trial: 0, starter: 0, pro: 0 }
      bucket[point.plan] = point.count
      counts.set(point.date, bucket)
    }

    const start = new Date()
    start.setHours(0, 0, 0, 0)
    start.setDate(start.getDate() - (days - 1))

    return Array.from({ length: days }).map((_, index) => {
      const current = new Date(start)
      current.setDate(start.getDate() + index)
      current.setHours(current.getHours() + 5)
      const date = current.toISOString().slice(0, 10)
      const bucket = counts.get(date) ?? { trial: 0, starter: 0, pro: 0 }

      return { date, ...bucket }
    })
  }, [days, timeline?.subscriptions_by_day])

  const expiringSoon = useMemo(() => {
    return normalizedShops
      .filter((shop) => {
        if (!shop.subscription) return false
        if (!['trial', 'active'].includes(shop.subscription.status)) return false
        return daysLeft(shop.subscription.expires_at) <= 7
      })
      .sort((left, right) => daysLeft(left.subscription!.expires_at) - daysLeft(right.subscription!.expires_at))
      .slice(0, 6)
  }, [normalizedShops])

  if (error) {
    return (
      <ErrorBlock
        title="Не удалось загрузить overview платформы"
        message={error}
        onRetry={() => window.location.reload()}
      />
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <section>
        <h1 className="text-3xl font-bold text-ink">Обзор платформы</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-secondary">
          Главная desktop-панель супер-администратора: активность заведений, подписки, пользователи и ближайшие риски по продлению.
        </p>
      </section>

      <FilterBar>
        <div className="flex flex-wrap gap-2">
          {DAY_OPTIONS.map((option) => (
            <FilterChip
              key={option}
              label={`${option} дней`}
              active={days === option}
              onClick={() => setDays(option)}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => router.push('/dashboard/admin/restaurants')}>
            Открыть заведения
          </Button>
          <Button variant="secondary" size="sm" onClick={() => router.push('/dashboard/admin/subscriptions')}>
            Подписки
          </Button>
        </div>
      </FilterBar>

      <section className="grid gap-4 xl:grid-cols-3 md:grid-cols-2">
        {loading || !stats || !timeline ? (
          Array.from({ length: 6 }).map((_, index) => <SkeletonStat key={index} />)
        ) : (
          <>
            <StatCard label="Заведений" value={String(stats.shops)} sub="в платформе" icon={<RestaurantIcon />} />
            <StatCard label="Активных подписок" value={String(stats.subscriptions.active)} sub="без trial" icon={<ActiveIcon />} />
            <StatCard label="Trial" value={String(stats.subscriptions.trial)} sub="в пробном периоде" icon={<TrialIcon />} />
            <StatCard label="Истёкших" value={String(stats.subscriptions.expired)} sub="требуют реакции" icon={<ExpiredIcon />} />
            <StatCard label="Пользователей" value={String(stats.users)} sub="во всей системе" icon={<UsersIcon />} />
            <StatCard label="Заказов сегодня" value={String(stats.today_orders)} sub="по всем заведениям" icon={<OrdersIcon />} variant="brand" />
          </>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.9fr_1fr]">
        <CardSection
          title="Новые подписки по дням"
          action={<span className="text-xs text-ink-muted">Окно: {days} дней</span>}
        >
          <div className="p-4">
            {loading || !timeline ? (
              <SkeletonCard className="h-[320px]" />
            ) : (
              <SubscriptionTimelineChart data={chartData} height={320} />
            )}
          </div>
        </CardSection>

        <CardSection title="Истекают в ближайшие 7 дней">
          <div className="divide-y divide-surface-border">
            {loading ? (
              <div className="space-y-3 p-4">
                <SkeletonCard className="h-20" />
                <SkeletonCard className="h-20" />
              </div>
            ) : expiringSoon.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-ink-secondary">
                В ближайшие 7 дней истечений нет.
              </div>
            ) : (
              expiringSoon.map((shop) => (
                <button
                  key={shop.id}
                  type="button"
                  onClick={() => router.push(`/dashboard/admin/restaurants/${shop.id}`)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-muted"
                >
                  <div>
                    <p className="text-sm font-semibold text-ink">{shop.name}</p>
                    <p className="mt-1 text-xs text-ink-secondary">
                      {shop.subscription ? formatDate(shop.subscription.expires_at) : 'Подписка не найдена'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-danger">
                      {shop.subscription ? `${daysLeft(shop.subscription.expires_at)} дн.` : '—'}
                    </p>
                    <p className="mt-1 text-xs text-ink-muted">
                      {shop.subscription?.plan ?? '—'}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </CardSection>
      </div>
    </div>
  )
}

function ErrorBlock({
  title,
  message,
  onRetry,
}: {
  title: string
  message: string
  onRetry: () => void
}) {
  return (
    <div className="rounded-3xl border border-red-200 bg-red-50 p-6">
      <h1 className="text-xl font-bold text-red-700">{title}</h1>
      <p className="mt-2 text-sm text-red-600">{message}</p>
      <div className="mt-4">
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Повторить
        </Button>
      </div>
    </div>
  )
}

function RestaurantIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9 12 3l9 6v11a1.8 1.8 0 0 1-1.8 1.8H4.8A1.8 1.8 0 0 1 3 20Z" />
      <path d="M9 21v-7h6v7" />
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2.2A3.8 3.8 0 0 0 13.2 15H6.8A3.8 3.8 0 0 0 3 18.8V21" />
      <circle cx="10" cy="7" r="4" />
      <path d="M21 21v-2.2A3.8 3.8 0 0 0 18 15.13" />
      <path d="M14 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function OrdersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  )
}

function ActiveIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="m9.5 12 1.75 1.75L14.5 10.5" />
    </svg>
  )
}

function TrialIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 6v6l4 2" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  )
}

function ExpiredIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </svg>
  )
}
