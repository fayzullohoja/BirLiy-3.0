'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import AppHeader from '@/components/layout/AppHeader'
import { BottomSheet } from '@/components/ui/BottomSheet'
import ConfirmSheet from '@/components/ui/ConfirmSheet'
import FormField from '@/components/ui/FormField'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'
import type {
  Shop, Subscription, ShopUser, AppUser,
  SubStatus, SubPlan, ShopUserRole,
} from '@/lib/types'

// ─── Extended types ───────────────────────────────────────────────────────────

interface ShopDetail extends Shop {
  subscription: Subscription | null
  members:      (ShopUser & { user?: AppUser })[]
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

const ROLE_LABELS: Record<ShopUserRole, string> = {
  owner:  'Владелец',
  waiter: 'Официант',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

function daysLeft(expiresAt: string) {
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000)
}

function initials(name: string) {
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminShopDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()

  const [shop, setShop]       = useState<ShopDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  // ── Edit shop form ─────────────────────────────────────────────────────────
  const [editOpen, setEditOpen]     = useState(false)
  const [editName, setEditName]     = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [editPhone, setEditPhone]   = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError]   = useState<string | null>(null)

  // ── Subscription form ──────────────────────────────────────────────────────
  const [subOpen, setSubOpen]       = useState(false)
  const [subStatus, setSubStatus]   = useState<SubStatus>('trial')
  const [subPlan, setSubPlan]       = useState<SubPlan>('trial')
  const [subExpiry, setSubExpiry]   = useState('')
  const [subSaving, setSubSaving]   = useState(false)
  const [subError, setSubError]     = useState<string | null>(null)

  // ── Assign member form ─────────────────────────────────────────────────────
  const [assignOpen, setAssignOpen]   = useState(false)
  const [assignUserId, setAssignUserId] = useState('')
  const [assignRole, setAssignRole]   = useState<ShopUserRole>('waiter')
  const [assignSaving, setAssignSaving] = useState(false)
  const [assignError, setAssignError] = useState<string | null>(null)

  // ── Remove member confirmation ─────────────────────────────────────────────
  const [removeTarget, setRemoveTarget] = useState<(ShopUser & { user?: AppUser }) | null>(null)
  const [removing, setRemoving]         = useState(false)

  // ── Telegram back button ───────────────────────────────────────────────────
  const tgBack = useRef<(() => void) | null>(null)
  useEffect(() => {
    const tg = (window as Window & {
      Telegram?: { WebApp?: {
        BackButton?: { show(): void; hide(): void; onClick(fn: () => void): void; offClick(fn: () => void): void }
      } }
    }).Telegram?.WebApp
    if (!tg?.BackButton) return
    tgBack.current = () => router.back()
    tg.BackButton.show()
    tg.BackButton.onClick(tgBack.current)
    return () => {
      if (tgBack.current) tg.BackButton?.offClick(tgBack.current)
      tg.BackButton?.hide()
    }
  }, [router])

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchShop = useCallback(() => {
    setLoading(true)
    fetch(`/api/admin/shops/${id}`)
      .then(r => r.json())
      .then(res => {
        if (res.error) { setError(res.error.message); return }
        const s = res.data as ShopDetail
        setShop(s)
        setEditName(s.name)
        setEditAddress(s.address ?? '')
        setEditPhone(s.phone ?? '')
        if (s.subscription) {
          setSubStatus(s.subscription.status)
          setSubPlan(s.subscription.plan)
          setSubExpiry(s.subscription.expires_at.slice(0, 10))
        }
      })
      .catch(() => setError('Не удалось загрузить заведение'))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => { fetchShop() }, [fetchShop])

  // ── Edit shop ──────────────────────────────────────────────────────────────

  async function handleEditSave() {
    if (!editName.trim()) { setEditError('Введите название'); return }
    setEditSaving(true); setEditError(null)
    try {
      const res = await fetch(`/api/admin/shops/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim(), address: editAddress || null, phone: editPhone || null }),
      }).then(r => r.json())
      if (res.error) { setEditError(res.error.message); return }
      setEditOpen(false)
      toast.success('Заведение обновлено')
      fetchShop()
    } finally { setEditSaving(false) }
  }

  // ── Subscription ──────────────────────────────────────────────────────────

  async function handleSubSave() {
    setSubSaving(true); setSubError(null)
    try {
      const res = await fetch(`/api/admin/subscriptions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: subStatus, plan: subPlan, expires_at: subExpiry }),
      }).then(r => r.json())
      if (res.error) { setSubError(res.error.message); return }
      setSubOpen(false)
      toast.success('Подписка обновлена')
      fetchShop()
    } finally { setSubSaving(false) }
  }

  function addDays(days: number) {
    const base = subExpiry ? new Date(subExpiry) : new Date()
    base.setDate(base.getDate() + days)
    setSubExpiry(base.toISOString().slice(0, 10))
  }

  // ── Assign member ─────────────────────────────────────────────────────────

  async function handleAssign() {
    if (!assignUserId.trim()) { setAssignError('Введите UUID пользователя'); return }
    setAssignSaving(true); setAssignError(null)
    try {
      const res = await fetch(`/api/admin/shops/${id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: assignUserId.trim(), role: assignRole }),
      }).then(r => r.json())
      if (res.error) { setAssignError(res.error.message); return }
      setAssignOpen(false)
      setAssignUserId('')
      setAssignRole('waiter')
      toast.success('Сотрудник добавлен')
      fetchShop()
    } finally { setAssignSaving(false) }
  }

  // ── Remove member ─────────────────────────────────────────────────────────

  async function handleRemove() {
    if (!removeTarget?.user_id) return
    setRemoving(true)
    try {
      await fetch(`/api/admin/shops/${id}/members?user_id=${removeTarget.user_id}`, { method: 'DELETE' })
      setRemoveTarget(null)
      toast.success('Сотрудник удалён')
      fetchShop()
    } finally { setRemoving(false) }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return <DetailSkeleton />

  if (error || !shop) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-ink-secondary text-center">{error ?? 'Заведение не найдено'}</p>
        <Button variant="secondary" onClick={() => router.back()}>Назад</Button>
      </div>
    )
  }

  const sub     = shop.subscription
  const members = shop.members ?? []
  const owners  = members.filter(m => m.role === 'owner')
  const waiters = members.filter(m => m.role === 'waiter')

  return (
    <div className="min-h-screen bg-surface-muted pb-safe">

      <AppHeader
        title={shop.name}
        subtitle={shop.address ?? 'Адрес не указан'}
        leftSlot={
          <button
            onClick={() => router.back()}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-ink-secondary hover:bg-surface-muted"
            aria-label="Назад"
          >
            <BackIcon />
          </button>
        }
        rightSlot={
          <button
            onClick={() => setEditOpen(true)}
            className="text-xs text-brand-600 font-semibold px-3 py-1.5 rounded-xl bg-brand-50"
          >
            Изменить
          </button>
        }
      />

      <div className="p-4 pt-20 flex flex-col gap-4">

        {/* Subscription card */}
        <section className="bg-surface rounded-2xl border border-surface-border overflow-hidden">
          <SectionHeader title="Подписка" onAction={() => setSubOpen(true)} actionLabel="Управлять" />
          {sub ? (
            <>
              <Row label="Статус"   value={<Badge variant={SUB_BADGE[sub.status]}>{SUB_LABEL[sub.status]}</Badge>} />
              <Row label="Тариф"    value={PLAN_LABELS[sub.plan] ?? sub.plan} />
              <Row label="Истекает" value={formatDate(sub.expires_at)} />
              <Row label="Осталось" value={(() => { const d = daysLeft(sub.expires_at); return d > 0 ? `${d} дней` : 'Истекла' })()} />
            </>
          ) : (
            <p className="px-4 py-6 text-center text-sm text-ink-muted">Подписка не создана</p>
          )}
        </section>

        {/* Shop info */}
        <section className="bg-surface rounded-2xl border border-surface-border overflow-hidden">
          <SectionHeader title="Информация" />
          <Row label="Телефон" value={shop.phone ?? '—'} />
          <Row label="Статус"  value={shop.is_active ? 'Активно' : 'Отключено'} />
          <Row label="Создано" value={formatDate(shop.created_at)} />
        </section>

        {/* Staff */}
        <section className="bg-surface rounded-2xl border border-surface-border overflow-hidden">
          <SectionHeader
            title={`Персонал (${members.length})`}
            onAction={() => setAssignOpen(true)}
            actionLabel="+ Добавить"
          />
          {members.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-ink-muted">Нет персонала</p>
          ) : (
            <div className="divide-y divide-surface-border">
              {[...owners, ...waiters].map(m => (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-brand-700">{initials(m.user?.name ?? '?')}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink truncate">{m.user?.name ?? '—'}</p>
                    <p className="text-xs text-ink-muted">{ROLE_LABELS[m.role]}</p>
                  </div>
                  {m.role !== 'owner' && (
                    <button
                      onClick={() => setRemoveTarget(m)}
                      className="text-xs text-danger font-semibold px-2.5 py-1 rounded-xl bg-red-50"
                    >
                      Убрать
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

      </div>

      {/* ── Edit shop sheet ──────────────────────────────────────────────────── */}
      <BottomSheet open={editOpen} onClose={() => setEditOpen(false)} title="Изменить заведение">
        <div className="px-4 py-4 flex flex-col gap-3">
          <FormField label="Название" required value={editName}    onChange={setEditName}    error={editError ?? undefined} />
          <FormField label="Адрес"             value={editAddress} onChange={setEditAddress} />
          <FormField label="Телефон"           value={editPhone}   onChange={setEditPhone}   type="tel" />
          <Button fullWidth loading={editSaving} onClick={handleEditSave}>Сохранить</Button>
        </div>
      </BottomSheet>

      {/* ── Subscription sheet ────────────────────────────────────────────────── */}
      <BottomSheet open={subOpen} onClose={() => setSubOpen(false)} title="Управление подпиской">
        <div className="px-4 py-4 flex flex-col gap-4">
          {/* Status */}
          <div>
            <p className="text-xs font-semibold text-ink-secondary mb-2 uppercase tracking-wide">Статус</p>
            <div className="grid grid-cols-2 gap-2">
              {(['trial', 'active', 'expired', 'suspended'] as SubStatus[]).map(s => (
                <OptionButton key={s} label={SUB_LABEL[s]} active={subStatus === s} onClick={() => setSubStatus(s)} />
              ))}
            </div>
          </div>
          {/* Plan */}
          <div>
            <p className="text-xs font-semibold text-ink-secondary mb-2 uppercase tracking-wide">Тариф</p>
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
            <p className="text-xs font-semibold text-ink-secondary mb-2 uppercase tracking-wide">Быстро продлить</p>
            <div className="flex gap-2">
              {[7, 30, 90, 365].map(d => (
                <button key={d} onClick={() => addDays(d)} className="flex-1 py-2 rounded-xl border border-surface-border bg-surface text-xs font-semibold text-ink-secondary hover:bg-surface-muted transition-colors">
                  +{d}д
                </button>
              ))}
            </div>
          </div>
          {subError && <p className="text-xs text-danger">{subError}</p>}
          <Button fullWidth loading={subSaving} onClick={handleSubSave}>Сохранить подписку</Button>
        </div>
      </BottomSheet>

      {/* ── Assign member sheet ───────────────────────────────────────────────── */}
      <BottomSheet open={assignOpen} onClose={() => setAssignOpen(false)} title="Добавить сотрудника">
        <div className="px-4 py-4 flex flex-col gap-3">
          <FormField
            label="UUID пользователя"
            required
            value={assignUserId}
            onChange={setAssignUserId}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            hint="Найдите пользователя на вкладке «Пользователи» и скопируйте его ID"
            error={assignError ?? undefined}
          />
          <div>
            <p className="text-xs font-semibold text-ink-secondary mb-2 uppercase tracking-wide">Роль</p>
            <div className="grid grid-cols-2 gap-2">
              <OptionButton label="Официант" active={assignRole === 'waiter'} onClick={() => setAssignRole('waiter')} />
              <OptionButton label="Владелец" active={assignRole === 'owner'}  onClick={() => setAssignRole('owner')} />
            </div>
          </div>
          <Button fullWidth loading={assignSaving} onClick={handleAssign}>Добавить</Button>
        </div>
      </BottomSheet>

      {/* ── Remove confirm ────────────────────────────────────────────────────── */}
      <ConfirmSheet
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={handleRemove}
        loading={removing}
        title="Убрать сотрудника?"
        description={`${removeTarget?.user?.name ?? 'Этот сотрудник'} будет удалён из заведения. Это не удаляет его аккаунт.`}
        confirmLabel="Убрать"
      />
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({
  title, onAction, actionLabel,
}: { title: string; onAction?: () => void; actionLabel?: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
      <p className="text-xs font-semibold text-ink-secondary uppercase tracking-wide">{title}</p>
      {onAction && actionLabel && (
        <button onClick={onAction} className="text-xs text-brand-600 font-semibold px-2.5 py-1 rounded-xl bg-brand-50">
          {actionLabel}
        </button>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string | React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border last:border-0">
      <span className="text-xs text-ink-secondary font-medium">{label}</span>
      {typeof value === 'string'
        ? <span className="text-sm font-semibold text-ink">{value}</span>
        : value}
    </div>
  )
}

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

function DetailSkeleton() {
  return (
    <div className="min-h-screen bg-surface-muted">
      <div className="h-14 bg-surface border-b border-surface-border animate-pulse" />
      <div className="p-4 pt-20 flex flex-col gap-4">
        {[140, 100, 200].map((h, i) => (
          <div key={i} style={{ height: h }} className="rounded-2xl bg-surface animate-pulse border border-surface-border" />
        ))}
      </div>
    </div>
  )
}

function BackIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
}
