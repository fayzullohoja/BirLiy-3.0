'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { CardSection } from '@/components/ui/Card'
import FormField from '@/components/ui/FormField'
import { toast } from '@/components/ui/Toast'
import ConfirmDialog from '@/components/dashboard/ConfirmDialog'
import DialogShell from '@/components/dashboard/DialogShell'
import SearchInput from '@/components/dashboard/SearchInput'
import { SkeletonCard, SkeletonRow } from '@/components/dashboard/Skeleton'
import { normalizeAdminShopRecord, daysLeft, type AdminShopMember, type AdminShopRecord } from '@/lib/dashboard/adminShopUtils'
import type { AppUser, ShopUserRole, SubPlan, SubStatus } from '@/lib/types'
import { formatDate } from '@/lib/utils'

interface AssignableUser extends AppUser {
  shops?: Array<{
    id: string
    role: ShopUserRole
    shop: { id: string; name: string; is_active: boolean } | null
  }>
}

const SUB_LABELS: Record<SubStatus, string> = {
  trial: 'Пробный',
  active: 'Активная',
  expired: 'Истекла',
  suspended: 'Заблокирована',
}

const SUB_VARIANTS: Record<SubStatus, 'warning' | 'success' | 'danger' | 'neutral'> = {
  trial: 'warning',
  active: 'success',
  expired: 'danger',
  suspended: 'neutral',
}

const PLAN_LABELS: Record<SubPlan, string> = {
  trial: 'Пробный',
  starter: 'Starter',
  pro: 'Pro',
}

const ROLE_LABELS: Record<ShopUserRole, string> = {
  owner: 'Владелец',
  manager: 'Менеджер',
  kitchen: 'Кухня',
  waiter: 'Официант',
}

const ROLE_BADGE_VARIANTS: Record<ShopUserRole, 'default' | 'warning' | 'info' | 'neutral'> = {
  owner: 'default',
  manager: 'info',
  kitchen: 'warning',
  waiter: 'info',
}

const INFO_EMPTY_FORM = {
  name: '',
  address: '',
  phone: '',
  is_active: true,
}

const SUB_EMPTY_FORM = {
  status: 'trial' as SubStatus,
  plan: 'trial' as SubPlan,
  expires_at: '',
}

export default function DashboardAdminRestaurantDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const shopId = params.id

  const [shop, setShop] = useState<ReturnType<typeof normalizeAdminShopRecord> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [infoOpen, setInfoOpen] = useState(false)
  const [infoForm, setInfoForm] = useState(INFO_EMPTY_FORM)
  const [infoSaving, setInfoSaving] = useState(false)

  const [subOpen, setSubOpen] = useState(false)
  const [subForm, setSubForm] = useState(SUB_EMPTY_FORM)
  const [subSaving, setSubSaving] = useState(false)

  const [assignOpen, setAssignOpen] = useState(false)
  const [assignSearch, setAssignSearch] = useState('')
  const [assignRole, setAssignRole] = useState<ShopUserRole>('waiter')
  const [assignTargetId, setAssignTargetId] = useState('')
  const [assignOptions, setAssignOptions] = useState<AssignableUser[]>([])
  const [assignLoading, setAssignLoading] = useState(false)
  const [assignSaving, setAssignSaving] = useState(false)

  const [removeTarget, setRemoveTarget] = useState<AdminShopMember | null>(null)
  const [removing, setRemoving] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const res = await fetch(`/api/admin/shops/${shopId}`, { cache: 'no-store' }).then((response) => response.json())
        if (cancelled) return

        if (res.error) {
          setError(res.error.message)
          return
        }

        const normalized = normalizeAdminShopRecord(res.data as AdminShopRecord)
        setShop(normalized)
        setInfoForm({
          name: normalized.name,
          address: normalized.address ?? '',
          phone: normalized.phone ?? '',
          is_active: normalized.is_active,
        })
        setSubForm({
          status: normalized.subscription?.status ?? 'trial',
          plan: normalized.subscription?.plan ?? 'trial',
          expires_at: normalized.subscription?.expires_at?.slice(0, 10) ?? '',
        })
      } catch {
        if (!cancelled) setError('Не удалось загрузить карточку заведения')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [shopId])

  useEffect(() => {
    if (!assignOpen) return

    let cancelled = false

    async function loadUsers() {
      setAssignLoading(true)
      try {
        const params = new URLSearchParams()
        if (assignSearch.trim()) params.set('search', assignSearch.trim())

        const res = await fetch(`/api/admin/users?${params.toString()}`, {
          cache: 'no-store',
        }).then((response) => response.json())

        if (cancelled) return
        if (res.error) {
          toast.error(res.error.message)
          return
        }

        const existingUserIds = new Set((shop?.members ?? []).map((member) => member.user_id))
        setAssignOptions(
          (res.data ?? []).filter((user: AssignableUser) => !existingUserIds.has(user.id)),
        )
      } catch {
        if (!cancelled) toast.error('Не удалось загрузить пользователей')
      } finally {
        if (!cancelled) setAssignLoading(false)
      }
    }

    void loadUsers()
    return () => {
      cancelled = true
    }
  }, [assignOpen, assignSearch, shop?.members])

  const groupedMembers = useMemo(() => ({
    owner: shop?.members.filter((member) => member.role === 'owner') ?? [],
    manager: shop?.members.filter((member) => member.role === 'manager') ?? [],
    kitchen: shop?.members.filter((member) => member.role === 'kitchen') ?? [],
    waiter: shop?.members.filter((member) => member.role === 'waiter') ?? [],
  }), [shop?.members])

  async function refreshShop() {
    const res = await fetch(`/api/admin/shops/${shopId}`, { cache: 'no-store' }).then((response) => response.json())
    if (res.error) throw new Error(res.error.message)

    const normalized = normalizeAdminShopRecord(res.data as AdminShopRecord)
    setShop(normalized)
    setInfoForm({
      name: normalized.name,
      address: normalized.address ?? '',
      phone: normalized.phone ?? '',
      is_active: normalized.is_active,
    })
    setSubForm({
      status: normalized.subscription?.status ?? 'trial',
      plan: normalized.subscription?.plan ?? 'trial',
      expires_at: normalized.subscription?.expires_at?.slice(0, 10) ?? '',
    })
  }

  async function handleSaveInfo() {
    if (!infoForm.name.trim()) {
      toast.error('Название заведения обязательно')
      return
    }

    setInfoSaving(true)
    try {
      const res = await fetch(`/api/admin/shops/${shopId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: infoForm.name.trim(),
          address: infoForm.address.trim() || null,
          phone: infoForm.phone.trim() || null,
          is_active: infoForm.is_active,
        }),
      }).then((response) => response.json())

      if (res.error) {
        toast.error(res.error.message)
        return
      }

      toast.success('Информация по заведению обновлена')
      setInfoOpen(false)
      await refreshShop()
    } catch {
      toast.error('Не удалось обновить заведение')
    } finally {
      setInfoSaving(false)
    }
  }

  async function handleQuickExtend(daysToAdd: number) {
    if (!shop?.subscription) return

    const base = new Date(shop.subscription.expires_at)
    base.setDate(base.getDate() + daysToAdd)

    try {
      const res = await fetch(`/api/admin/subscriptions/${shopId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expires_at: base.toISOString() }),
      }).then((response) => response.json())

      if (res.error) {
        toast.error(res.error.message)
        return
      }

      toast.success(`Подписка продлена на ${daysToAdd} дней`)
      await refreshShop()
    } catch {
      toast.error('Не удалось продлить подписку')
    }
  }

  async function handleSaveSubscription() {
    setSubSaving(true)
    try {
      const res = await fetch(`/api/admin/subscriptions/${shopId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subForm),
      }).then((response) => response.json())

      if (res.error) {
        toast.error(res.error.message)
        return
      }

      toast.success('Подписка обновлена')
      setSubOpen(false)
      await refreshShop()
    } catch {
      toast.error('Не удалось обновить подписку')
    } finally {
      setSubSaving(false)
    }
  }

  async function handleAssignMember() {
    if (!assignTargetId) {
      toast.error('Выберите пользователя из списка')
      return
    }

    setAssignSaving(true)
    try {
      const res = await fetch(`/api/admin/shops/${shopId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: assignTargetId, role: assignRole }),
      }).then((response) => response.json())

      if (res.error) {
        toast.error(res.error.message)
        return
      }

      toast.success('Сотрудник добавлен в заведение')
      setAssignOpen(false)
      setAssignSearch('')
      setAssignRole('waiter')
      setAssignTargetId('')
      await refreshShop()
    } catch {
      toast.error('Не удалось добавить сотрудника')
    } finally {
      setAssignSaving(false)
    }
  }

  async function handleRemoveMember() {
    if (!removeTarget) return

    setRemoving(true)
    try {
      const res = await fetch(
        `/api/admin/shops/${shopId}/members?user_id=${removeTarget.user_id}`,
        { method: 'DELETE' },
      )

      if (!res.ok) {
        const json = await res.json().catch(() => null)
        toast.error(json?.error?.message ?? 'Не удалось удалить сотрудника')
        return
      }

      toast.success('Сотрудник удалён из заведения')
      setRemoveTarget(null)
      await refreshShop()
    } catch {
      toast.error('Не удалось удалить сотрудника')
    } finally {
      setRemoving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <SkeletonCard className="h-32" />
        <SkeletonCard className="h-56" />
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="space-y-3">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        </div>
      </div>
    )
  }

  if (error || !shop) {
    return (
      <ErrorBlock
        title="Не удалось открыть заведение"
        message={error ?? 'Заведение не найдено'}
        onBack={() => router.push('/dashboard/admin/restaurants')}
      />
    )
  }

  return (
    <>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="flex items-start justify-between gap-4">
          <div>
            <button
              type="button"
              onClick={() => router.push('/dashboard/admin/restaurants')}
              className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-ink-secondary hover:text-ink"
            >
              <BackIcon />
              К списку заведений
            </button>
            <h1 className="text-3xl font-bold text-ink">{shop.name}</h1>
            <p className="mt-2 text-sm text-ink-secondary">
              {shop.address ?? 'Адрес не указан'}{shop.phone ? ` · ${shop.phone}` : ''}
            </p>
          </div>
          <Button variant="secondary" onClick={() => setInfoOpen(true)}>
            Изменить данные
          </Button>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
          <CardSection title="Информация">
            <div className="grid gap-4 p-5 md:grid-cols-2">
              <InfoItem label="Название" value={shop.name} />
              <InfoItem label="Статус" value={shop.is_active ? 'Активно' : 'Отключено'} />
              <InfoItem label="Адрес" value={shop.address ?? '—'} />
              <InfoItem label="Телефон" value={shop.phone ?? '—'} />
              <InfoItem label="Создано" value={formatDate(shop.created_at)} />
              <InfoItem label="Сотрудников" value={String(shop.members.length)} />
            </div>
          </CardSection>

          <CardSection
            title="Подписка"
            action={
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => handleQuickExtend(30)}>
                  +30 дней
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleQuickExtend(365)}>
                  +365 дней
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setSubOpen(true)}>
                  Изменить
                </Button>
              </div>
            }
          >
            <div className="space-y-4 p-5">
              {shop.subscription ? (
                <>
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge variant={SUB_VARIANTS[shop.subscription.status]}>
                      {SUB_LABELS[shop.subscription.status]}
                    </Badge>
                    <Badge variant="neutral">{PLAN_LABELS[shop.subscription.plan]}</Badge>
                  </div>
                  <InfoItem label="Истекает" value={formatDate(shop.subscription.expires_at)} />
                  <InfoItem label="Осталось" value={`${daysLeft(shop.subscription.expires_at)} дней`} />
                </>
              ) : (
                <p className="text-sm text-ink-secondary">Подписка ещё не создана.</p>
              )}
            </div>
          </CardSection>
        </div>

        <CardSection
          title={`Персонал (${shop.members.length})`}
          action={<Button onClick={() => setAssignOpen(true)}>Добавить сотрудника</Button>}
        >
          <div className="space-y-6 p-5">
            <RoleSection title="Владельцы" members={groupedMembers.owner} onRemove={setRemoveTarget} />
            <RoleSection title="Менеджеры" members={groupedMembers.manager} onRemove={setRemoveTarget} />
            <RoleSection title="Кухня" members={groupedMembers.kitchen} onRemove={setRemoveTarget} />
            <RoleSection title="Официанты" members={groupedMembers.waiter} onRemove={setRemoveTarget} />
          </div>
        </CardSection>
      </div>

      {infoOpen && (
        <DialogShell title="Редактировать заведение" onClose={() => !infoSaving && setInfoOpen(false)} maxWidthClassName="max-w-lg">
          <div className="space-y-4">
            <FormField
              label="Название"
              required
              value={infoForm.name}
              onChange={(value) => setInfoForm((prev) => ({ ...prev, name: value }))}
            />
            <FormField
              label="Адрес"
              value={infoForm.address}
              onChange={(value) => setInfoForm((prev) => ({ ...prev, address: value }))}
            />
            <FormField
              label="Телефон"
              type="tel"
              value={infoForm.phone}
              onChange={(value) => setInfoForm((prev) => ({ ...prev, phone: value }))}
            />
            <label className="flex items-center justify-between rounded-2xl border border-surface-border bg-surface-muted px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-ink">Активность заведения</p>
                <p className="mt-1 text-xs text-ink-secondary">Супер-админ может временно отключить заведение.</p>
              </div>
              <button
                type="button"
                onClick={() => setInfoForm((prev) => ({ ...prev, is_active: !prev.is_active }))}
                className={`inline-flex h-8 min-w-[72px] items-center justify-center rounded-full px-3 text-xs font-semibold ${infoForm.is_active ? 'bg-brand-600 text-white' : 'border border-surface-border bg-white text-ink-secondary'}`}
              >
                {infoForm.is_active ? 'Вкл' : 'Выкл'}
              </button>
            </label>
            <div className="flex justify-end">
              <Button loading={infoSaving} onClick={handleSaveInfo}>
                Сохранить
              </Button>
            </div>
          </div>
        </DialogShell>
      )}

      {subOpen && (
        <DialogShell title="Управление подпиской" onClose={() => !subSaving && setSubOpen(false)} maxWidthClassName="max-w-lg">
          <div className="space-y-4">
            <FormField
              as="select"
              label="Статус"
              value={subForm.status}
              onChange={(value) => setSubForm((prev) => ({ ...prev, status: value as SubStatus }))}
            >
              <option value="trial">Пробный</option>
              <option value="active">Активная</option>
              <option value="expired">Истекла</option>
              <option value="suspended">Заблокирована</option>
            </FormField>
            <FormField
              as="select"
              label="Тариф"
              value={subForm.plan}
              onChange={(value) => setSubForm((prev) => ({ ...prev, plan: value as SubPlan }))}
            >
              <option value="trial">Пробный</option>
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
            </FormField>
            <FormField
              label="Дата окончания"
              type="date"
              value={subForm.expires_at}
              onChange={(value) => setSubForm((prev) => ({ ...prev, expires_at: value }))}
            />
            <div className="flex justify-end">
              <Button loading={subSaving} onClick={handleSaveSubscription}>
                Сохранить
              </Button>
            </div>
          </div>
        </DialogShell>
      )}

      {assignOpen && (
        <DialogShell
          title="Добавить сотрудника"
          description="Выберите пользователя, который уже зарегистрирован в системе, и назначьте ему роль в этом заведении."
          onClose={() => {
            if (assignSaving) return
            setAssignOpen(false)
            setAssignSearch('')
            setAssignRole('waiter')
            setAssignTargetId('')
          }}
        >
          <div className="space-y-4">
            <SearchInput
              value={assignSearch}
              onChange={setAssignSearch}
              placeholder="Поиск по имени или username"
            />
            <FormField
              as="select"
              label="Роль в заведении"
              value={assignRole}
              onChange={(value) => setAssignRole(value as ShopUserRole)}
            >
              <option value="waiter">Официант</option>
              <option value="kitchen">Кухня</option>
              <option value="manager">Менеджер</option>
              <option value="owner">Владелец</option>
            </FormField>

            <div className="max-h-[320px] overflow-y-auto rounded-2xl border border-surface-border">
              {assignLoading ? (
                <div className="space-y-2 p-4">
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </div>
              ) : assignOptions.length === 0 ? (
                <div className="p-6 text-center text-sm text-ink-secondary">
                  Подходящие пользователи не найдены.
                </div>
              ) : (
                <div className="divide-y divide-surface-border">
                  {assignOptions.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => setAssignTargetId(user.id)}
                      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${assignTargetId === user.id ? 'bg-brand-50' : 'bg-white hover:bg-surface-muted'}`}
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                        {initials(user.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
                          {assignTargetId === user.id && <Badge variant="default">Выбран</Badge>}
                        </div>
                        <p className="mt-1 text-xs text-ink-secondary">
                          {user.username ? `@${user.username}` : 'Без username'}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <Button loading={assignSaving} onClick={handleAssignMember}>
                Добавить
              </Button>
            </div>
          </div>
        </DialogShell>
      )}

      <ConfirmDialog
        open={!!removeTarget}
        title="Удалить сотрудника из заведения?"
        description={
          removeTarget?.user
            ? `${removeTarget.user.name} потеряет доступ к этому заведению.`
            : undefined
        }
        confirmLabel="Удалить"
        loading={removing}
        onClose={() => setRemoveTarget(null)}
        onConfirm={handleRemoveMember}
      />
    </>
  )
}

function RoleSection({
  title,
  members,
  onRemove,
}: {
  title: string
  members: AdminShopMember[]
  onRemove: (member: AdminShopMember) => void
}) {
  if (members.length === 0) return null

  return (
    <section className="overflow-hidden rounded-3xl border border-surface-border bg-white shadow-sm">
      <div className="border-b border-surface-border px-5 py-4">
        <h2 className="text-lg font-bold text-ink">{title}</h2>
      </div>
      <div className="divide-y divide-surface-border">
        {members.map((member) => (
          <div key={member.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
              {initials(member.user?.name ?? '?')}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-base font-semibold text-ink">{member.user?.name ?? 'Без имени'}</p>
                <Badge variant={ROLE_BADGE_VARIANTS[member.role]}>{ROLE_LABELS[member.role]}</Badge>
              </div>
              <p className="mt-1 text-sm text-ink-secondary">
                {member.user?.username ? `@${member.user.username}` : `Telegram ID: ${member.user?.telegram_id ?? '—'}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="neutral">Добавлен {new Date(member.created_at).toLocaleDateString('ru-RU')}</Badge>
              <Button variant="ghost" size="sm" onClick={() => onRemove(member)}>
                Удалить
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-surface-border bg-surface-muted px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">{label}</p>
      <p className="mt-2 text-sm font-semibold text-ink">{value}</p>
    </div>
  )
}

function ErrorBlock({
  title,
  message,
  onBack,
}: {
  title: string
  message: string
  onBack: () => void
}) {
  return (
    <div className="rounded-3xl border border-red-200 bg-red-50 p-6">
      <h1 className="text-xl font-bold text-red-700">{title}</h1>
      <p className="mt-2 text-sm text-red-600">{message}</p>
      <div className="mt-4">
        <Button variant="secondary" size="sm" onClick={onBack}>
          К списку заведений
        </Button>
      </div>
    </div>
  )
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  )
}
