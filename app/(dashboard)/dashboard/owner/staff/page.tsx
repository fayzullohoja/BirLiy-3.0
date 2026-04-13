'use client'

import { useEffect, useMemo, useState } from 'react'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import FormField from '@/components/ui/FormField'
import { toast } from '@/components/ui/Toast'
import ConfirmDialog from '@/components/dashboard/ConfirmDialog'
import FilterBar from '@/components/dashboard/FilterBar'
import FilterChip from '@/components/dashboard/FilterChip'
import SearchInput from '@/components/dashboard/SearchInput'
import { SkeletonCard, SkeletonRow } from '@/components/dashboard/Skeleton'
import { useDashboardSession } from '@/components/dashboard/DashboardSessionContext'
import type { AppUser, ShopUser, ShopUserRole } from '@/lib/types'

type AssignableUser = AppUser & {
  shops?: Array<{
    id: string
    role: ShopUserRole
    shop: { id: string; name: string; is_active: boolean } | null
  }>
}

const ROLE_LABELS: Record<ShopUserRole, string> = {
  owner: 'Владелец',
  kitchen: 'Кухня',
  waiter: 'Официант',
}

const ROLE_BADGE_VARIANTS: Record<ShopUserRole, 'default' | 'warning' | 'info'> = {
  owner: 'default',
  kitchen: 'warning',
  waiter: 'info',
}

export default function DashboardOwnerStaffPage() {
  const session = useDashboardSession()
  const [staff, setStaff] = useState<ShopUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [roleFilter, setRoleFilter] = useState<'all' | ShopUserRole>('all')
  const [search, setSearch] = useState('')

  const [assignOpen, setAssignOpen] = useState(false)
  const [assignSearch, setAssignSearch] = useState('')
  const [assignRole, setAssignRole] = useState<ShopUserRole>('waiter')
  const [assignTargetId, setAssignTargetId] = useState('')
  const [assignOptions, setAssignOptions] = useState<AssignableUser[]>([])
  const [assignLoading, setAssignLoading] = useState(false)
  const [assignSaving, setAssignSaving] = useState(false)

  const [removeTarget, setRemoveTarget] = useState<ShopUser | null>(null)
  const [removing, setRemoving] = useState(false)

  useEffect(() => {
    if (!session.selectedShopId) return

    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/staff?shop_id=${session.selectedShopId}`, {
          cache: 'no-store',
        }).then((response) => response.json())

        if (cancelled) return
        if (res.error) {
          setError(res.error.message)
          return
        }

        setStaff(res.data ?? [])
      } catch {
        if (!cancelled) setError('Не удалось загрузить персонал')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [session.selectedShopId])

  useEffect(() => {
    if (!assignOpen || !session.selectedShopId) return

    let cancelled = false
    async function loadUsers() {
      setAssignLoading(true)
      try {
        const shopId = session.selectedShopId
        if (!shopId) return

        const params = new URLSearchParams({ shop_id: shopId })
        if (assignSearch.trim()) params.set('search', assignSearch.trim())

        const res = await fetch(`/api/admin/users?${params.toString()}`, {
          cache: 'no-store',
        }).then((response) => response.json())

        if (cancelled) return
        if (res.error) {
          toast.error(res.error.message)
          return
        }

        const existingUserIds = new Set(staff.map((member) => member.user_id))
        setAssignOptions(
          (res.data ?? []).filter((user: AssignableUser) => !existingUserIds.has(user.id)),
        )
      } catch {
        if (!cancelled) toast.error('Не удалось загрузить список пользователей')
      } finally {
        if (!cancelled) setAssignLoading(false)
      }
    }

    void loadUsers()
    return () => {
      cancelled = true
    }
  }, [assignOpen, assignSearch, session.selectedShopId, staff])

  const visibleStaff = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return staff.filter((member) => {
      if (roleFilter !== 'all' && member.role !== roleFilter) return false
      if (!needle) return true

      const username = member.user?.username?.toLowerCase() ?? ''
      const name = member.user?.name.toLowerCase() ?? ''
      return name.includes(needle) || username.includes(needle)
    })
  }, [roleFilter, search, staff])

  const grouped = useMemo(() => ({
    owner: visibleStaff.filter((member) => member.role === 'owner'),
    kitchen: visibleStaff.filter((member) => member.role === 'kitchen'),
    waiter: visibleStaff.filter((member) => member.role === 'waiter'),
  }), [visibleStaff])

  async function handleAssign() {
    if (!session.selectedShopId || !assignTargetId) {
      toast.error('Выберите пользователя из списка')
      return
    }

    setAssignSaving(true)
    try {
      const res = await fetch(`/api/admin/shops/${session.selectedShopId}/members`, {
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
      setAssignTargetId('')
      setAssignSearch('')
      setAssignRole('waiter')
      setStaff((prev) => [normalizeMember(res.data), ...prev])
    } catch {
      toast.error('Не удалось добавить сотрудника')
    } finally {
      setAssignSaving(false)
    }
  }

  async function handleRemove() {
    if (!removeTarget || !session.selectedShopId) return

    setRemoving(true)
    try {
      const res = await fetch(
        `/api/staff?shop_id=${session.selectedShopId}&user_id=${removeTarget.user_id}`,
        { method: 'DELETE' },
      )

      if (!res.ok) {
        const json = await res.json().catch(() => null)
        toast.error(json?.error?.message ?? 'Не удалось удалить сотрудника')
        return
      }

      toast.success('Сотрудник удалён из заведения')
      setStaff((prev) => prev.filter((member) => member.id !== removeTarget.id))
      setRemoveTarget(null)
    } catch {
      toast.error('Не удалось удалить сотрудника')
    } finally {
      setRemoving(false)
    }
  }

  if (loading || session.loading) {
    return (
      <div className="space-y-6">
        <SkeletonCard className="h-[108px]" />
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

  if (error) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {error}
      </div>
    )
  }

  return (
    <>
      <div className="space-y-6">
        <FilterBar>
          <div className="flex flex-1 flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <FilterChip label={`Все (${staff.length})`} active={roleFilter === 'all'} onClick={() => setRoleFilter('all')} />
              <FilterChip label={`Владельцы (${grouped.owner.length})`} active={roleFilter === 'owner'} onClick={() => setRoleFilter('owner')} />
              <FilterChip label={`Кухня (${grouped.kitchen.length})`} active={roleFilter === 'kitchen'} onClick={() => setRoleFilter('kitchen')} />
              <FilterChip label={`Официанты (${grouped.waiter.length})`} active={roleFilter === 'waiter'} onClick={() => setRoleFilter('waiter')} />
            </div>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Поиск по имени или username"
              className="w-full max-w-md"
            />
          </div>

          <Button onClick={() => setAssignOpen(true)}>
            Добавить сотрудника
          </Button>
        </FilterBar>

        <div className="grid gap-4 lg:grid-cols-3">
          <SummaryCard title="Владельцы" value={grouped.owner.length} description="Полный доступ к заведению" />
          <SummaryCard title="Кухня" value={grouped.kitchen.length} description="Очередь заказов и готовность" />
          <SummaryCard title="Официанты" value={grouped.waiter.length} description="Столы, заказы и оплата" />
        </div>

        <div className="space-y-6">
          <StaffSection title="Владельцы" members={grouped.owner} currentUserId={session.userId} onRemove={setRemoveTarget} />
          <StaffSection title="Кухня" members={grouped.kitchen} currentUserId={session.userId} onRemove={setRemoveTarget} />
          <StaffSection title="Официанты" members={grouped.waiter} currentUserId={session.userId} onRemove={setRemoveTarget} />
        </div>
      </div>

      {assignOpen && (
        <DialogShell
          title="Добавить сотрудника"
          description="Выберите пользователя, который уже зарегистрировался через Telegram, и назначьте ему роль в текущем заведении."
          onClose={() => {
            setAssignOpen(false)
            setAssignTargetId('')
            setAssignSearch('')
            setAssignRole('waiter')
          }}
        >
          <div className="space-y-4">
            <SearchInput
              value={assignSearch}
              onChange={setAssignSearch}
              placeholder="Поиск по имени или username"
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                as="select"
                label="Роль"
                value={assignRole}
                onChange={(value) => setAssignRole(value as ShopUserRole)}
              >
                <option value="waiter">Официант</option>
                <option value="kitchen">Кухня</option>
                <option value="owner">Владелец</option>
              </FormField>
            </div>

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
                  {assignOptions.map((user) => {
                    const isSelected = user.id === assignTargetId
                    return (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => setAssignTargetId(user.id)}
                        className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${isSelected ? 'bg-brand-50' : 'bg-white hover:bg-surface-muted'}`}
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                          {initials(user.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
                            {isSelected && <Badge variant="default">Выбран</Badge>}
                          </div>
                          <p className="mt-1 text-xs text-ink-secondary">
                            {user.username ? `@${user.username}` : 'Без username'}
                          </p>
                          <p className="mt-1 text-xs text-ink-muted">
                            Заведения: {user.shops?.length ?? 0}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <Button loading={assignSaving} onClick={handleAssign}>
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
            ? `${removeTarget.user.name} потеряет доступ к этому заведению и dashboard-контексту этого магазина.`
            : undefined
        }
        confirmLabel="Удалить"
        loading={removing}
        onClose={() => setRemoveTarget(null)}
        onConfirm={handleRemove}
      />
    </>
  )
}

function StaffSection({
  title,
  members,
  currentUserId,
  onRemove,
}: {
  title: string
  members: ShopUser[]
  currentUserId: string | null
  onRemove: (member: ShopUser) => void
}) {
  if (members.length === 0) return null

  return (
    <section className="overflow-hidden rounded-3xl border border-surface-border bg-white shadow-sm">
      <div className="border-b border-surface-border px-5 py-4">
        <h2 className="text-lg font-bold text-ink">{title}</h2>
      </div>
      <div className="divide-y divide-surface-border">
        {members.map((member) => {
          const user = member.user
          return (
            <div key={member.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                {initials(user?.name ?? '?')}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-base font-semibold text-ink">{user?.name ?? 'Без имени'}</p>
                  <Badge variant={ROLE_BADGE_VARIANTS[member.role]}>{ROLE_LABELS[member.role]}</Badge>
                </div>
                <p className="mt-1 text-sm text-ink-secondary">
                  {user?.username ? `@${user.username}` : `Telegram ID: ${user?.telegram_id ?? '—'}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="neutral">Добавлен {new Date(member.created_at).toLocaleDateString('ru-RU')}</Badge>
                {user?.id !== currentUserId && (
                  <Button variant="ghost" size="sm" onClick={() => onRemove(member)}>
                    Удалить
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function SummaryCard({
  title,
  value,
  description,
}: {
  title: string
  value: number
  description: string
}) {
  return (
    <section className="rounded-3xl border border-surface-border bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">{title}</p>
      <p className="mt-3 text-3xl font-bold text-ink">{value}</p>
      <p className="mt-2 text-sm text-ink-secondary">{description}</p>
    </section>
  )
}

function DialogShell({
  title,
  description,
  children,
  onClose,
}: {
  title: string
  description?: string
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Закрыть окно"
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
      />
      <div className="relative z-10 w-full max-w-2xl rounded-3xl border border-surface-border bg-white p-6 shadow-card-md">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-ink">{title}</h2>
            {description && <p className="mt-2 text-sm text-ink-secondary">{description}</p>}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>Закрыть</Button>
        </div>
        {children}
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

function normalizeMember(member: ShopUser) {
  return {
    ...member,
    user: Array.isArray(member.user) ? member.user[0] : member.user,
  }
}
