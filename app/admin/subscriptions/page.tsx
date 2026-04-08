'use client'

import { useCallback, useEffect, useState } from 'react'
import AppHeader from '@/components/layout/AppHeader'
import PageContainer, { Section, EmptyState } from '@/components/ui/PageContainer'
import { CardSection, ListItem } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { BottomSheet } from '@/components/ui/BottomSheet'
import FormField from '@/components/ui/FormField'
import { toast } from '@/components/ui/Toast'
import type { SubStatus, SubPlan } from '@/lib/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SubRow {
  id:         string
  shop_id:    string
  status:     SubStatus
  plan:       SubPlan
  expires_at: string
  updated_at: string
  shop:       { id: string; name: string } | null
}

// ─── Config ───────────────────────────────────────────────────────────────────

const SUB_LABEL: Record<SubStatus, string> = {
  trial:     'Пробный',
  active:    'Активная',
  expired:   'Истекла',
  suspended: 'Заблокирована',
}

const SUB_BADGE: Record<SubStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  trial:     'warning',
  active:    'success',
  expired:   'danger',
  suspended: 'neutral',
}

const PLAN_LABELS: Record<SubPlan, string> = {
  trial:   'Пробный',
  starter: 'Стартер',
  pro:     'Про',
}

const FILTER_OPTIONS: { value: '' | SubStatus; label: string }[] = [
  { value: '',           label: 'Все' },
  { value: 'trial',      label: 'Пробный' },
  { value: 'active',     label: 'Активные' },
  { value: 'expired',    label: 'Истекли' },
  { value: 'suspended',  label: 'Заблок.' },
]

function daysLeft(expiresAt: string) {
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000)
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminSubscriptionsPage() {
  const [subs, setSubs]       = useState<SubRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [filter, setFilter]   = useState<'' | SubStatus>('')

  // Edit sheet
  const [editTarget, setEditTarget] = useState<SubRow | null>(null)
  const [subStatus, setSubStatus]   = useState<SubStatus>('trial')
  const [subPlan, setSubPlan]       = useState<SubPlan>('trial')
  const [subExpiry, setSubExpiry]   = useState('')
  const [saving, setSaving]         = useState(false)
  const [saveError, setSaveError]   = useState<string | null>(null)

  const fetchSubs = useCallback(() => {
    setLoading(true)
    fetch('/api/admin/shops')
      .then(r => r.json())
      .then(res => {
        if (res.error) { setError(res.error.message); return }
        const rows: SubRow[] = (res.data ?? [])
          .filter((s: { subscription: SubRow | null }) => s.subscription)
          .map((s: { id: string; name: string; subscription: SubRow }) => ({
            ...s.subscription,
            shop: { id: s.id, name: s.name },
          }))
        setSubs(filter ? rows.filter(r => r.status === filter) : rows)
      })
      .catch(() => setError('Не удалось загрузить подписки'))
      .finally(() => setLoading(false))
  }, [filter])

  useEffect(() => { fetchSubs() }, [fetchSubs])

  function openEdit(sub: SubRow) {
    setEditTarget(sub)
    setSubStatus(sub.status)
    setSubPlan(sub.plan)
    setSubExpiry(sub.expires_at.slice(0, 10))
    setSaveError(null)
  }

  async function handleSave() {
    if (!editTarget) return
    setSaving(true); setSaveError(null)
    try {
      const res = await fetch(`/api/admin/subscriptions/${editTarget.shop_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: subStatus, plan: subPlan, expires_at: subExpiry }),
      }).then(r => r.json())
      if (res.error) { setSaveError(res.error.message); return }
      setEditTarget(null)
      toast.success(`Подписка «${editTarget.shop?.name}» обновлена`)
      fetchSubs()
    } finally { setSaving(false) }
  }

  function addDays(days: number) {
    const base = subExpiry ? new Date(subExpiry) : new Date()
    base.setDate(base.getDate() + days)
    setSubExpiry(base.toISOString().slice(0, 10))
  }

  // Sort: expired and suspended first
  const PRIORITY: Record<SubStatus, number> = { expired: 0, suspended: 1, trial: 2, active: 3 }
  const sorted = [...subs].sort((a, b) => {
    const diff = PRIORITY[a.status] - PRIORITY[b.status]
    return diff !== 0 ? diff : new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime()
  })

  return (
    <>
      <AppHeader
        title="Подписки"
        subtitle={loading ? '' : `${subs.length} заведений`}
      />

      <PageContainer>
        {/* Filter chips */}
        <div className="flex px-4 pt-4 gap-2 pb-3 overflow-x-auto scrollbar-hide">
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                filter === opt.value
                  ? 'bg-brand-600 text-white'
                  : 'bg-surface text-ink-secondary border border-surface-border'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <Section className="pb-6">
          {loading ? (
            <SubSkeleton />
          ) : error ? (
            <EmptyState
              title="Ошибка загрузки"
              description={error}
              action={<Button variant="secondary" size="sm" onClick={fetchSubs}>Повторить</Button>}
            />
          ) : sorted.length === 0 ? (
            <EmptyState title="Нет подписок" description="По этому фильтру ничего не найдено" />
          ) : (
            <CardSection>
              <div className="divide-y divide-surface-border">
                {sorted.map(sub => {
                  const days = daysLeft(sub.expires_at)
                  return (
                    <ListItem
                      key={sub.id}
                      leading={
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          sub.status === 'active'  ? 'bg-green-100' :
                          sub.status === 'trial'   ? 'bg-blue-100'  :
                          sub.status === 'expired' ? 'bg-red-100'   : 'bg-gray-100'
                        }`}>
                          <span className={`text-sm font-bold ${
                            sub.status === 'active'  ? 'text-green-700' :
                            sub.status === 'trial'   ? 'text-blue-700'  :
                            sub.status === 'expired' ? 'text-red-700'   : 'text-gray-600'
                          }`}>
                            {sub.shop?.name.charAt(0).toUpperCase() ?? '?'}
                          </span>
                        </div>
                      }
                      title={sub.shop?.name ?? 'Неизвестно'}
                      subtitle={`${PLAN_LABELS[sub.plan]} · до ${fmtDate(sub.expires_at)}`}
                      trailing={
                        <div className="flex flex-col items-end gap-1">
                          <Badge variant={SUB_BADGE[sub.status]}>{SUB_LABEL[sub.status]}</Badge>
                          <span className={`text-xs font-medium ${days < 7 ? 'text-danger' : 'text-ink-muted'}`}>
                            {days > 0 ? `${days} дн.` : 'Истекла'}
                          </span>
                        </div>
                      }
                      onClick={() => openEdit(sub)}
                    />
                  )
                })}
              </div>
            </CardSection>
          )}
        </Section>
      </PageContainer>

      {/* Edit sheet */}
      <BottomSheet open={!!editTarget} onClose={() => setEditTarget(null)} title="Управление подпиской">
        <div className="px-4 py-4 flex flex-col gap-4">
          <p className="text-sm font-semibold text-ink">{editTarget?.shop?.name}</p>

          {/* Status */}
          <div>
            <p className="text-xs font-semibold text-ink-secondary uppercase tracking-wide mb-2">Статус</p>
            <div className="grid grid-cols-2 gap-2">
              {(['trial', 'active', 'expired', 'suspended'] as SubStatus[]).map(s => (
                <OptionButton key={s} label={SUB_LABEL[s]} active={subStatus === s} onClick={() => setSubStatus(s)} />
              ))}
            </div>
          </div>

          {/* Plan */}
          <div>
            <p className="text-xs font-semibold text-ink-secondary uppercase tracking-wide mb-2">Тариф</p>
            <div className="grid grid-cols-3 gap-2">
              {(['trial', 'starter', 'pro'] as SubPlan[]).map(p => (
                <OptionButton key={p} label={PLAN_LABELS[p]} active={subPlan === p} onClick={() => setSubPlan(p)} />
              ))}
            </div>
          </div>

          {/* Expiry */}
          <FormField label="Дата истечения" as="input" type="date" value={subExpiry} onChange={setSubExpiry} />

          {/* Quick extend */}
          <div>
            <p className="text-xs font-semibold text-ink-secondary uppercase tracking-wide mb-2">Быстро продлить</p>
            <div className="flex gap-2">
              {[7, 30, 90, 365].map(d => (
                <button key={d} onClick={() => addDays(d)} className="flex-1 py-2 rounded-xl border border-surface-border bg-surface text-xs font-semibold text-ink-secondary hover:bg-surface-muted transition-colors">
                  +{d}д
                </button>
              ))}
            </div>
          </div>

          {saveError && <p className="text-xs text-danger">{saveError}</p>}
          <Button fullWidth loading={saving} onClick={handleSave}>Сохранить</Button>
          <Button variant="ghost" fullWidth onClick={() => setEditTarget(null)} disabled={saving}>Отмена</Button>
        </div>
      </BottomSheet>
    </>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function OptionButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
        active
          ? 'border-brand-600 bg-brand-50 text-brand-700'
          : 'border-surface-border bg-surface text-ink-secondary hover:bg-surface-muted'
      }`}
    >
      {label}
    </button>
  )
}

function SubSkeleton() {
  return (
    <div className="rounded-2xl bg-surface border border-surface-border overflow-hidden">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-16 border-b border-surface-border animate-pulse bg-surface-muted last:border-0" />
      ))}
    </div>
  )
}
