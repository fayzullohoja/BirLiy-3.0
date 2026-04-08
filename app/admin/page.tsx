'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import AppHeader from '@/components/layout/AppHeader'
import PageContainer, { Section } from '@/components/ui/PageContainer'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlatformStats {
  shops:         number
  users:         number
  subscriptions: { trial: number; active: number; expired: number; suspended: number }
  today_orders:  number
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const [stats, setStats]     = useState<PlatformStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(r => r.json())
      .then(res => {
        if (res.error) setError(res.error.message)
        else setStats(res.data)
      })
      .catch(() => setError('Не удалось загрузить статистику'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <>
      <AppHeader title="BirLiy Admin" subtitle="Обзор платформы" />

      <PageContainer>
        <Section className="pt-4">
          {loading ? (
            <StatsSkeleton />
          ) : error ? (
            <div className="rounded-2xl bg-red-50 border border-red-200 p-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          ) : stats ? (
            <>
              {/* Main metric grid */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <StatCard label="Заведений"      value={stats.shops}                                       color="blue"   icon={<ShopIcon />} />
                <StatCard label="Пользователей"  value={stats.users}                                       color="purple" icon={<UsersIcon />} />
                <StatCard label="Заказов сегодня" value={stats.today_orders}                               color="green"  icon={<OrderIcon />} />
                <StatCard label="Активных сабов"  value={stats.subscriptions.active + stats.subscriptions.trial} color="amber" icon={<SubIcon />} />
              </div>

              {/* Subscription breakdown */}
              <div className="bg-surface rounded-2xl border border-surface-border overflow-hidden mb-4">
                <div className="px-4 py-3 border-b border-surface-border">
                  <p className="text-xs font-semibold text-ink-secondary uppercase tracking-wide">Подписки по статусу</p>
                </div>
                <div className="divide-y divide-surface-border">
                  <SubRow label="Пробный период"   count={stats.subscriptions.trial}     dot="bg-blue-400" />
                  <SubRow label="Активные"          count={stats.subscriptions.active}    dot="bg-green-500" />
                  <SubRow label="Просроченные"      count={stats.subscriptions.expired}   dot="bg-red-400" />
                  <SubRow label="Заблокированные"   count={stats.subscriptions.suspended} dot="bg-gray-400" />
                </div>
              </div>

              {/* Quick nav */}
              <div className="grid grid-cols-2 gap-3 pb-6">
                <NavTile href="/admin/restaurants"   label="Заведения"     sub="Управление"  icon={<ShopIcon />} />
                <NavTile href="/admin/users"          label="Пользователи"  sub="Все роли"    icon={<UsersIcon />} />
                <NavTile href="/admin/subscriptions"  label="Подписки"      sub="Продление"   icon={<SubIcon />} />
              </div>
            </>
          ) : null}
        </Section>
      </PageContainer>
    </>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const COLOR_MAP: Record<string, string> = {
  blue:   'bg-blue-50 text-blue-700',
  purple: 'bg-purple-50 text-purple-700',
  green:  'bg-green-50 text-green-700',
  amber:  'bg-amber-50 text-amber-700',
}

function StatCard({ label, value, color, icon }: {
  label: string; value: number; color: string; icon: React.ReactNode
}) {
  return (
    <div className={`rounded-2xl p-4 ${COLOR_MAP[color] ?? 'bg-surface'}`}>
      <div className="mb-2 opacity-70">{icon}</div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs font-medium opacity-80 mt-0.5">{label}</p>
    </div>
  )
}

function SubRow({ label, count, dot }: { label: string; count: number; dot: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-2">
        <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />
        <span className="text-sm text-ink">{label}</span>
      </div>
      <span className="text-sm font-bold text-ink">{count}</span>
    </div>
  )
}

function NavTile({ href, label, sub, icon }: {
  href: string; label: string; sub: string; icon: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="bg-surface rounded-2xl border border-surface-border p-4 flex flex-col gap-2 active:scale-[0.98] transition-transform"
    >
      <span className="text-ink-secondary">{icon}</span>
      <div>
        <p className="text-sm font-semibold text-ink">{label}</p>
        <p className="text-xs text-ink-muted">{sub}</p>
      </div>
    </Link>
  )
}

function StatsSkeleton() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-surface animate-pulse border border-surface-border" />
        ))}
      </div>
      <div className="h-48 rounded-2xl bg-surface animate-pulse border border-surface-border" />
    </div>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function ShopIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
}
function UsersIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
}
function OrderIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
}
function SubIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>
}
