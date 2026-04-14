'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import FormField from '@/components/ui/FormField'
import { toast } from '@/components/ui/Toast'
import ConfirmDialog from '@/components/dashboard/ConfirmDialog'
import DialogShell from '@/components/dashboard/DialogShell'
import FilterBar from '@/components/dashboard/FilterBar'
import FilterChip from '@/components/dashboard/FilterChip'
import SearchInput from '@/components/dashboard/SearchInput'
import { SkeletonCard, SkeletonRow } from '@/components/dashboard/Skeleton'
import { useDashboardSession } from '@/components/dashboard/DashboardSessionContext'
import type { AppUser, ShopInviteCode, ShopUser, ShopUserRole } from '@/lib/types'
import {
  SHOP_ROLE_LABELS,
  canChangeStaffRole,
  canRemoveStaffRole,
  getAssignableShopRoles,
  getInviteManageableRoles,
} from '@/lib/roles'

type AssignableUser = AppUser & {
  shops?: Array<{
    id: string
    role: ShopUserRole
    shop: { id: string; name: string; is_active: boolean } | null
  }>
}

const ROLE_BADGE_VARIANTS: Record<ShopUserRole, 'default' | 'info' | 'warning' | 'neutral'> = {
  owner: 'default',
  manager: 'info',
  waiter: 'neutral',
  kitchen: 'warning',
}

type RoleFilter = 'all' | ShopUserRole

const ROLE_FILTERS: RoleFilter[] = ['all', 'owner', 'manager', 'kitchen', 'waiter']

export default function DashboardOwnerStaffPage() {
  const session = useDashboardSession()
  const actorRole =
    session.role === 'super_admin'
      ? 'super_admin'
      : session.role === 'owner' || session.role === 'manager'
        ? session.role
        : null

  const [staff, setStaff] = useState<ShopUser[]>([])
  const [codes, setCodes] = useState<ShopInviteCode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')

  const [assignOpen, setAssignOpen] = useState(false)
  const [assignSearch, setAssignSearch] = useState('')
  const [assignRole, setAssignRole] = useState<ShopUserRole>('waiter')
  const [assignTargetId, setAssignTargetId] = useState('')
  const [assignOptions, setAssignOptions] = useState<AssignableUser[]>([])
  const [assignLoading, setAssignLoading] = useState(false)
  const [assignSaving, setAssignSaving] = useState(false)

  const [editTarget, setEditTarget] = useState<ShopUser | null>(null)
  const [nextRole, setNextRole] = useState<ShopUserRole>('waiter')
  const [savingRole, setSavingRole] = useState(false)

  const [removeTarget, setRemoveTarget] = useState<ShopUser | null>(null)
  const [removing, setRemoving] = useState(false)

  const [rotatingRole, setRotatingRole] = useState<ShopUserRole | null>(null)

  const manageableRoles = useMemo(
    () => (actorRole ? getInviteManageableRoles(actorRole) : []),
    [actorRole],
  )

  const assignableRoles = useMemo(
    () => (actorRole ? getAssignableShopRoles(actorRole) : []),
    [actorRole],
  )

  const fetchData = useCallback(async () => {
    if (session.loading || !session.selectedShopId) return

    setLoading(true)
    setError(null)

    try {
      const [staffRes, codesRes] = await Promise.all([
        fetch(`/api/staff?shop_id=${session.selectedShopId}`, { cache: 'no-store' }).then((response) => response.json()),
        actorRole
          ? fetch(`/api/invite/codes?shop_id=${session.selectedShopId}`, { cache: 'no-store' }).then((response) => response.json())
          : Promise.resolve({ data: [], error: null }),
      ])

      if (staffRes.error) {
        setError(staffRes.error.message)
        return
      }
      if (codesRes.error) {
        setError(codesRes.error.message)
        return
      }

      setStaff(staffRes.data ?? [])
      setCodes(codesRes.data ?? [])
    } catch {
      setError('Не удалось загрузить персонал')
    } finally {
      setLoading(false)
    }
  }, [actorRole, session.loading, session.selectedShopId])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  useEffect(() => {
    if (!assignOpen || !session.selectedShopId) return

    let cancelled = false

    async function loadUsers() {
      setAssignLoading(true)
      try {
        const params = new URLSearchParams({ shop_id: session.selectedShopId! })
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

  const codeByRole = useMemo(
    () => new Map(codes.map((code) => [code.role, code])),
    [codes],
  )

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

  const groupedMembers = useMemo(() => ({
    owner: visibleStaff.filter((member) => member.role === 'owner'),
    manager: visibleStaff.filter((member) => member.role === 'manager'),
    kitchen: visibleStaff.filter((member) => member.role === 'kitchen'),
    waiter: visibleStaff.filter((member) => member.role === 'waiter'),
  }), [visibleStaff])

  const counts = useMemo(() => ({
    all: staff.length,
    owner: staff.filter((member) => member.role === 'owner').length,
    manager: staff.filter((member) => member.role === 'manager').length,
    kitchen: staff.filter((member) => member.role === 'kitchen').length,
    waiter: staff.filter((member) => member.role === 'waiter').length,
  }), [staff])

  const availableRoleOptions = useMemo(() => {
    if (!actorRole || !editTarget) return []
    return getAssignableShopRoles(actorRole).filter((role) => canChangeStaffRole(actorRole, editTarget.role, role))
  }, [actorRole, editTarget])

  function openEdit(member: ShopUser) {
    setEditTarget(member)
    setNextRole(member.role)
  }

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
      setAssignRole(assignableRoles.includes('waiter') ? 'waiter' : assignableRoles[0] ?? 'waiter')
      await fetchData()
    } catch {
      toast.error('Не удалось добавить сотрудника')
    } finally {
      setAssignSaving(false)
    }
  }

  async function handleRoleSave() {
    if (!editTarget || !session.selectedShopId) return

    setSavingRole(true)
    try {
      const res = await fetch('/api/staff', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop_id: session.selectedShopId,
          user_id: editTarget.user_id,
          role: nextRole,
        }),
      }).then((response) => response.json())

      if (res.error) {
        toast.error(res.error.message)
        return
      }

      toast.success('Роль сотрудника обновлена')
      setStaff((prev) => prev.map((member) => (member.id === res.data.id ? res.data : member)))
      setEditTarget(null)
    } catch {
      toast.error('Не удалось обновить роль')
    } finally {
      setSavingRole(false)
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

  async function handleRotateCode(role: ShopUserRole) {
    if (!session.selectedShopId) return

    setRotatingRole(role)
    try {
      const res = await fetch('/api/invite/codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop_id: session.selectedShopId, role }),
      }).then((response) => response.json())

      if (res.error) {
        toast.error(res.error.message)
        return
      }

      setCodes((prev) => {
        const filtered = prev.filter((code) => code.role !== role)
        return [...filtered, res.data]
      })
      toast.success(`Код для роли «${SHOP_ROLE_LABELS[role]}» обновлён`)
    } catch {
      toast.error('Не удалось обновить код')
    } finally {
      setRotatingRole(null)
    }
  }

  async function handleCopyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code)
      toast.success('Код скопирован')
    } catch {
      toast.error('Не удалось скопировать код')
    }
  }

  if (loading || session.loading) {
    return (
      <div className="space-y-6">
        <SkeletonCard className="h-[128px]" />
        <SkeletonCard className="h-[220px]" />
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
      <ErrorBlock
        title="Не удалось загрузить персонал"
        message={error}
        onRetry={() => window.location.reload()}
      />
    )
  }

  return (
    <>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section>
          <h1 className="text-3xl font-bold text-ink">Персонал</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-secondary">
            Управляйте составом заведения, меняйте роли сотрудников и выдавайте коды подключения для новых членов команды.
          </p>
        </section>

        <FilterBar>
          <div className="flex flex-1 flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {ROLE_FILTERS.map((filter) => (
                <FilterChip
                  key={filter}
                  label={filter === 'all' ? 'Все' : SHOP_ROLE_LABELS[filter]}
                  count={counts[filter]}
                  active={roleFilter === filter}
                  onClick={() => setRoleFilter(filter)}
                />
              ))}
            </div>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Поиск по имени или username"
              className="w-full max-w-md"
            />
          </div>

          {actorRole && (
            <Button onClick={() => setAssignOpen(true)}>
              Добавить сотрудника
            </Button>
          )}
        </FilterBar>

        <div className="grid gap-4 lg:grid-cols-4 md:grid-cols-2">
          <SummaryCard title="Владельцы" value={counts.owner} description="Полный доступ и критичные настройки" />
          <SummaryCard title="Менеджеры" value={counts.manager} description="Операционное управление заведением" />
          <SummaryCard title="Кухня" value={counts.kitchen} description="Очередь кухни и статус готовности" />
          <SummaryCard title="Официанты" value={counts.waiter} description="Столы, заказы и приём оплаты" />
        </div>

        {actorRole && manageableRoles.length > 0 && (
          <section className="rounded-3xl border border-surface-border bg-white p-6 shadow-sm">
            <div className="mb-4">
              <h2 className="text-xl font-bold text-ink">Коды приглашения</h2>
              <p className="mt-2 text-sm text-ink-secondary">
                Новые сотрудники вводят 8-значный код в mini app и автоматически подключаются к текущему заведению с нужной ролью.
              </p>
            </div>
            <div className="grid gap-4 xl:grid-cols-3 lg:grid-cols-2">
              {manageableRoles.map((role) => (
                <InviteCodeCard
                  key={role}
                  role={role}
                  code={codeByRole.get(role) ?? null}
                  loading={rotatingRole === role}
                  onCopy={handleCopyCode}
                  onRegenerate={() => handleRotateCode(role)}
                />
              ))}
            </div>
          </section>
        )}

        <div className="space-y-6">
          <StaffSection title="Владельцы" members={groupedMembers.owner} currentUserId={session.userId} actorRole={actorRole} onEdit={openEdit} onRemove={setRemoveTarget} />
          <StaffSection title="Менеджеры" members={groupedMembers.manager} currentUserId={session.userId} actorRole={actorRole} onEdit={openEdit} onRemove={setRemoveTarget} />
          <StaffSection title="Кухня" members={groupedMembers.kitchen} currentUserId={session.userId} actorRole={actorRole} onEdit={openEdit} onRemove={setRemoveTarget} />
          <StaffSection title="Официанты" members={groupedMembers.waiter} currentUserId={session.userId} actorRole={actorRole} onEdit={openEdit} onRemove={setRemoveTarget} />
        </div>
      </div>

      {assignOpen && (
        <DialogShell
          title="Добавить сотрудника"
          description="Выберите пользователя, который уже авторизовался через Telegram, и назначьте ему роль в текущем заведении."
          onClose={() => {
            if (assignSaving) return
            setAssignOpen(false)
            setAssignTargetId('')
            setAssignSearch('')
            setAssignRole(assignableRoles.includes('waiter') ? 'waiter' : assignableRoles[0] ?? 'waiter')
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
              {assignableRoles.map((role) => (
                <option key={role} value={role}>
                  {SHOP_ROLE_LABELS[role]}
                </option>
              ))}
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

      {editTarget && (
        <DialogShell
          title="Изменить роль"
          description={editTarget.user?.name ? `Сотрудник: ${editTarget.user.name}` : undefined}
          onClose={() => !savingRole && setEditTarget(null)}
          maxWidthClassName="max-w-lg"
        >
          <div className="space-y-4">
            {availableRoleOptions.length === 0 ? (
              <p className="text-sm text-ink-secondary">
                Для этого сотрудника смена роли через ваш уровень доступа недоступна.
              </p>
            ) : (
              <div className="grid gap-2">
                {availableRoleOptions.map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setNextRole(role)}
                    className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition-colors ${
                      nextRole === role
                        ? 'border-brand-600 bg-brand-50 text-brand-700'
                        : 'border-surface-border bg-surface text-ink-secondary hover:bg-surface-muted'
                    }`}
                  >
                    {SHOP_ROLE_LABELS[role]}
                  </button>
                ))}
              </div>
            )}

            <div className="flex justify-end">
              <Button loading={savingRole} disabled={availableRoleOptions.length === 0} onClick={handleRoleSave}>
                Сохранить роль
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
            ? `${removeTarget.user.name} потеряет доступ к этому заведению и всем связанным рабочим экранам.`
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
  actorRole,
  onEdit,
  onRemove,
}: {
  title: string
  members: ShopUser[]
  currentUserId: string | null
  actorRole: 'owner' | 'manager' | 'super_admin' | null
  onEdit: (member: ShopUser) => void
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
          const name = user?.name ?? 'Без имени'
          const isSelf = user?.id === currentUserId
          const canEdit = actorRole
            ? !isSelf && getAssignableShopRoles(actorRole).some((role) => canChangeStaffRole(actorRole, member.role, role))
            : false
          const canRemove = actorRole ? !isSelf && canRemoveStaffRole(actorRole, member.role) : false

          return (
            <div key={member.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                {initials(name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-base font-semibold text-ink">{name}</p>
                  <Badge variant={ROLE_BADGE_VARIANTS[member.role]}>{SHOP_ROLE_LABELS[member.role]}</Badge>
                </div>
                <p className="mt-1 text-sm text-ink-secondary">
                  {user?.username ? `@${user.username}` : `Telegram ID: ${user?.telegram_id ?? '—'}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="neutral">Добавлен {new Date(member.created_at).toLocaleDateString('ru-RU')}</Badge>
                {canEdit && (
                  <Button variant="ghost" size="sm" onClick={() => onEdit(member)}>
                    Изменить роль
                  </Button>
                )}
                {canRemove && (
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

function InviteCodeCard({
  role,
  code,
  loading,
  onCopy,
  onRegenerate,
}: {
  role: ShopUserRole
  code: ShopInviteCode | null
  loading: boolean
  onCopy: (code: string) => void
  onRegenerate: () => void
}) {
  return (
    <div className="rounded-3xl border border-surface-border bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">{SHOP_ROLE_LABELS[role]}</p>
          <p className="mt-1 text-sm text-ink-secondary">
            {code ? 'Действующий код для подключения сотрудников' : 'Код для роли ещё не создан'}
          </p>
        </div>
        <Badge variant={ROLE_BADGE_VARIANTS[role]}>{SHOP_ROLE_LABELS[role]}</Badge>
      </div>

      <div className="mt-4 rounded-2xl border border-dashed border-brand-300 bg-brand-50 px-4 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">Код приглашения</p>
        <p className="mt-2 font-mono text-2xl font-bold tracking-[0.24em] text-brand-700">
          {code?.code ?? '--------'}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        {code && (
          <Button variant="ghost" size="sm" onClick={() => onCopy(code.code)}>
            Скопировать
          </Button>
        )}
        <Button size="sm" loading={loading} onClick={onRegenerate}>
          {code ? 'Перевыпустить' : 'Создать'}
        </Button>
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

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}
