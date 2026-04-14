'use client'

import { useEffect, useState } from 'react'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import FormField from '@/components/ui/FormField'
import { toast } from '@/components/ui/Toast'
import { SkeletonCard } from '@/components/dashboard/Skeleton'
import { useDashboardSession } from '@/components/dashboard/DashboardSessionContext'
import type { Shop, Subscription, SubPlan, SubStatus } from '@/lib/types'

interface ShopSettingsResponse extends Shop {
  subscription: Subscription | null
}

const SUB_STATUS_LABELS: Record<SubStatus, string> = {
  active: 'Активна',
  trial: 'Пробный период',
  expired: 'Истекла',
  suspended: 'Приостановлена',
}

const SUB_PLAN_LABELS: Record<SubPlan, string> = {
  trial: 'Пробный',
  starter: 'Starter',
  pro: 'Pro',
}

const SUB_BADGE_VARIANTS: Record<SubStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  active: 'success',
  trial: 'warning',
  expired: 'danger',
  suspended: 'neutral',
}

export default function DashboardOwnerSettingsPage() {
  const session = useDashboardSession()
  const [shop, setShop] = useState<ShopSettingsResponse | null>(null)
  const [form, setForm] = useState({ name: '', address: '', phone: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isManager = session.role === 'manager'

  useEffect(() => {
    if (!session.selectedShopId) return

    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const res = await fetch(`/api/admin/shops/${session.selectedShopId}`, {
          cache: 'no-store',
        }).then((response) => response.json())

        if (cancelled) return

        if (res.error) {
          setError(res.error.message)
          return
        }

        const nextShop = res.data as ShopSettingsResponse
        setShop(nextShop)
        setForm({
          name: nextShop.name,
          address: nextShop.address ?? '',
          phone: nextShop.phone ?? '',
        })
      } catch {
        if (!cancelled) setError('Не удалось загрузить настройки заведения')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [session.selectedShopId])

  async function handleSave() {
    if (!session.selectedShopId) return
    if (!form.name.trim()) {
      toast.error('Введите название заведения')
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/admin/shops/${session.selectedShopId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          address: form.address.trim() || null,
          phone: form.phone.trim() || null,
        }),
      }).then((response) => response.json())

      if (res.error) {
        toast.error(res.error.message)
        return
      }

      toast.success('Настройки заведения обновлены')
      setShop((prev) => prev ? {
        ...prev,
        name: res.data.name,
        address: res.data.address,
        phone: res.data.phone,
      } : prev)
    } catch {
      toast.error('Не удалось сохранить настройки')
    } finally {
      setSaving(false)
    }
  }

  if (!session.loading && isManager) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
        Настройки заведения и подписки доступны только владельцу или супер-администратору.
      </div>
    )
  }

  if (loading || session.loading) {
    return (
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <SkeletonCard className="h-[320px]" />
        <SkeletonCard className="h-[220px]" />
      </div>
    )
  }

  if (error || !shop) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {error ?? 'Не удалось открыть настройки заведения'}
      </div>
    )
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section className="rounded-3xl border border-surface-border bg-white p-6 shadow-sm">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Настройки</p>
          <h2 className="mt-2 text-2xl font-bold text-ink">Карточка заведения</h2>
          <p className="mt-2 max-w-2xl text-sm text-ink-secondary">
            Обновите публичные данные текущего заведения. Изменения сохраняются сразу для owner и dashboard-контекста.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <FormField
            label="Название заведения"
            required
            value={form.name}
            onChange={(value) => setForm((prev) => ({ ...prev, name: value }))}
          />
          <FormField
            label="Телефон"
            type="tel"
            value={form.phone}
            onChange={(value) => setForm((prev) => ({ ...prev, phone: value }))}
          />
          <FormField
            label="Адрес"
            className="lg:col-span-2"
            value={form.address}
            onChange={(value) => setForm((prev) => ({ ...prev, address: value }))}
          />
        </div>

        <div className="mt-6 flex flex-col gap-3 border-t border-surface-border pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-ink-secondary">
            Текущее заведение в dashboard: <span className="font-semibold text-ink">{shop.name}</span>
          </div>
          <Button loading={saving} onClick={handleSave}>
            Сохранить изменения
          </Button>
        </div>
      </section>

      <aside className="space-y-4">
        <section className="rounded-3xl border border-surface-border bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Подписка</p>
          {shop.subscription ? (
            <div className="mt-4 space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant={SUB_BADGE_VARIANTS[shop.subscription.status]}>
                  {SUB_STATUS_LABELS[shop.subscription.status]}
                </Badge>
                <Badge variant="neutral">{SUB_PLAN_LABELS[shop.subscription.plan]}</Badge>
              </div>
              <InfoRow label="Истекает" value={formatLongDate(shop.subscription.expires_at)} />
              <InfoRow label="Дней осталось" value={String(Math.max(0, Math.ceil((new Date(shop.subscription.expires_at).getTime() - Date.now()) / 86_400_000)))} />
            </div>
          ) : (
            <p className="mt-4 text-sm text-ink-secondary">Подписка ещё не назначена.</p>
          )}
        </section>

        <section className="rounded-3xl border border-surface-border bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Справка</p>
          <ul className="mt-4 space-y-2 text-sm leading-relaxed text-ink-secondary">
            <li>Название и адрес используются в owner dashboard и карточках заведения.</li>
            <li>Смена телефона не требует перевхода в mini app.</li>
            <li>Подпиской продолжает управлять super admin.</li>
          </ul>
        </section>
      </aside>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-ink-secondary">{label}</span>
      <span className="font-semibold text-ink">{value}</span>
    </div>
  )
}

function formatLongDate(value: string) {
  return new Date(value).toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Tashkent',
  })
}
