'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import AppHeader from '@/components/layout/AppHeader'
import PageContainer, { Section, EmptyState } from '@/components/ui/PageContainer'
import { CardSection, ListItem } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { toast } from '@/components/ui/Toast'
import { useOwnerSession } from '../_context/OwnerSessionContext'
import type { ShopInviteCode, ShopUser, ShopUserRole } from '@/lib/types'
import {
  SHOP_ROLE_LABELS,
  canChangeStaffRole,
  canRemoveStaffRole,
  getAssignableShopRoles,
  getInviteManageableRoles,
} from '@/lib/roles'

const ROLE_BADGE_VARIANTS: Record<ShopUserRole, 'neutral' | 'warning' | 'default' | 'info'> = {
  owner: 'default',
  manager: 'info',
  kitchen: 'warning',
  waiter: 'neutral',
}

function initials(name: string) {
  return name.split(' ').map((part) => part[0]).join('').toUpperCase().slice(0, 2)
}

export default function OwnerStaffPage() {
  const session = useOwnerSession()
  const actorRole = session.role === 'super_admin' ? 'super_admin' : session.role === 'owner' || session.role === 'manager' ? session.role : null

  const [staff, setStaff] = useState<ShopUser[]>([])
  const [codes, setCodes] = useState<ShopInviteCode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editTarget, setEditTarget] = useState<ShopUser | null>(null)
  const [nextRole, setNextRole] = useState<ShopUserRole>('waiter')
  const [savingRole, setSavingRole] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<ShopUser | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [rotatingRole, setRotatingRole] = useState<ShopUserRole | null>(null)

  const manageableRoles = useMemo(
    () => (actorRole ? getInviteManageableRoles(actorRole) : []),
    [actorRole],
  )

  const fetchData = useCallback(async () => {
    if (session.loading || !session.primaryShopId) return
    setLoading(true)
    setError(null)

    try {
      const [staffRes, codesRes] = await Promise.all([
        fetch(`/api/staff?shop_id=${session.primaryShopId}`, { cache: 'no-store' }).then((r) => r.json()),
        actorRole
          ? fetch(`/api/invite/codes?shop_id=${session.primaryShopId}`, { cache: 'no-store' }).then((r) => r.json())
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
  }, [actorRole, session.loading, session.primaryShopId])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const codeByRole = useMemo(() => {
    return new Map(codes.map((code) => [code.role, code]))
  }, [codes])

  const grouped = useMemo(() => ({
    owner: staff.filter((member) => member.role === 'owner'),
    manager: staff.filter((member) => member.role === 'manager'),
    kitchen: staff.filter((member) => member.role === 'kitchen'),
    waiter: staff.filter((member) => member.role === 'waiter'),
  }), [staff])

  const availableRoleOptions = useMemo(() => {
    if (!actorRole || !editTarget) return []
    return getAssignableShopRoles(actorRole).filter((role) => canChangeStaffRole(actorRole, editTarget.role, role))
  }, [actorRole, editTarget])

  function openEdit(member: ShopUser) {
    setEditTarget(member)
    setNextRole(member.role)
  }

  async function handleRoleSave() {
    if (!editTarget || !session.primaryShopId) return

    setSavingRole(true)
    try {
      const res = await fetch('/api/staff', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop_id: session.primaryShopId,
          user_id: editTarget.user_id,
          role: nextRole,
        }),
      }).then((response) => response.json())

      if (res.error) {
        toast.error(res.error.message)
        return
      }

      toast.success('Роль сотрудника обновлена')
      setStaff((prev) => prev.map((member) => member.id === res.data.id ? res.data : member))
      setEditTarget(null)
    } catch {
      toast.error('Не удалось обновить роль')
    } finally {
      setSavingRole(false)
    }
  }

  async function handleRemove() {
    if (!deleteTarget?.user || !session.primaryShopId) return

    setDeleting(true)
    try {
      const res = await fetch(
        `/api/staff?shop_id=${session.primaryShopId}&user_id=${deleteTarget.user.id}`,
        { method: 'DELETE' },
      )

      if (!res.ok) {
        const json = await res.json().catch(() => null)
        toast.error(json?.error?.message ?? 'Не удалось удалить сотрудника')
        return
      }

      setDeleteTarget(null)
      setStaff((prev) => prev.filter((member) => member.id !== deleteTarget.id))
      toast.success('Сотрудник удалён')
    } finally {
      setDeleting(false)
    }
  }

  async function handleRotateCode(role: ShopUserRole) {
    if (!session.primaryShopId) return
    setRotatingRole(role)

    try {
      const res = await fetch('/api/invite/codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop_id: session.primaryShopId, role }),
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

  return (
    <>
      <AppHeader
        title="Персонал"
        subtitle={loading ? '' : `${staff.length} сотрудников`}
      />

      <PageContainer>
        {loading || session.loading ? (
          <Section className="pt-4">
            <StaffSkeleton />
          </Section>
        ) : error ? (
          <Section className="pt-4">
            <EmptyState title="Ошибка" description={error} />
          </Section>
        ) : (
          <>
            {actorRole && manageableRoles.length > 0 && (
              <Section title="Коды приглашения" className="pt-4">
                <div className="grid gap-3">
                  {manageableRoles.map((role) => (
                    <InviteCodeCard
                      key={role}
                      role={role}
                      code={codeByRole.get(role) ?? null}
                      loading={rotatingRole === role}
                      onRegenerate={() => handleRotateCode(role)}
                    />
                  ))}
                </div>
              </Section>
            )}

            {staff.length === 0 ? (
              <Section className="pt-5">
                <EmptyState
                  title="Персонал не добавлен"
                  description="Сотрудники могут подключиться по ролевому коду или быть добавлены владельцем позже."
                />
              </Section>
            ) : (
              <>
                <StaffSection title="Владельцы" members={grouped.owner} currentUserId={session.userId} actorRole={actorRole} onEdit={openEdit} onRemove={setDeleteTarget} />
                <StaffSection title="Менеджеры" members={grouped.manager} currentUserId={session.userId} actorRole={actorRole} onEdit={openEdit} onRemove={setDeleteTarget} />
                <StaffSection title="Кухня" members={grouped.kitchen} currentUserId={session.userId} actorRole={actorRole} onEdit={openEdit} onRemove={setDeleteTarget} />
                <StaffSection title="Официанты" members={grouped.waiter} currentUserId={session.userId} actorRole={actorRole} onEdit={openEdit} onRemove={setDeleteTarget} />
              </>
            )}
          </>
        )}
      </PageContainer>

      <BottomSheet
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Изменить роль"
      >
        <div className="px-4 py-4 flex flex-col gap-3">
          <p className="text-sm text-ink-secondary">
            Сотрудник: <strong className="text-ink">{editTarget?.user?.name}</strong>
          </p>
          {availableRoleOptions.length === 0 ? (
            <p className="text-sm text-ink-secondary">Для этого сотрудника смена роли через ваш уровень доступа недоступна.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {availableRoleOptions.map((role) => (
                <button
                  key={role}
                  onClick={() => setNextRole(role)}
                  className={`w-full py-3 rounded-xl border text-sm font-semibold transition-colors ${
                    nextRole === role
                      ? 'border-brand-600 bg-brand-50 text-brand-700'
                      : 'border-surface-border bg-surface text-ink-secondary'
                  }`}
                >
                  {SHOP_ROLE_LABELS[role]}
                </button>
              ))}
            </div>
          )}
          <Button
            fullWidth
            loading={savingRole}
            disabled={savingRole || availableRoleOptions.length === 0}
            onClick={handleRoleSave}
          >
            Сохранить роль
          </Button>
          <Button variant="ghost" fullWidth onClick={() => setEditTarget(null)} disabled={savingRole}>
            Отмена
          </Button>
        </div>
      </BottomSheet>

      <BottomSheet
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Удалить сотрудника?"
      >
        <div className="px-4 py-4 flex flex-col gap-3">
          <p className="text-sm text-ink-secondary">
            Удалить <strong>{deleteTarget?.user?.name}</strong> из заведения? Он потеряет доступ к рабочему интерфейсу.
          </p>
          <Button fullWidth variant="danger" loading={deleting} onClick={handleRemove}>
            Удалить
          </Button>
          <Button variant="ghost" fullWidth onClick={() => setDeleteTarget(null)} disabled={deleting}>
            Отмена
          </Button>
        </div>
      </BottomSheet>
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
    <Section title={title} className="pt-5 pb-1">
      <CardSection>
        <div className="divide-y divide-surface-border">
          {members.map((member) => {
            const user = member.user
            const name = user?.name ?? 'Без имени'
            const canSelfTarget = user?.id === currentUserId
            const canEdit = actorRole ? !canSelfTarget && getAssignableShopRoles(actorRole).some((role) => canChangeStaffRole(actorRole, member.role, role)) : false
            const canRemove = actorRole ? !canSelfTarget && canRemoveStaffRole(actorRole, member.role) : false

            return (
              <ListItem
                key={member.id}
                leading={
                  <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-brand-700">{initials(name)}</span>
                  </div>
                }
                title={name}
                subtitle={user?.username ? `@${user.username}` : `ID: ${user?.telegram_id ?? '—'}`}
                trailing={
                  <div className="flex items-center gap-2">
                    <Badge variant={ROLE_BADGE_VARIANTS[member.role]}>{SHOP_ROLE_LABELS[member.role]}</Badge>
                    {canEdit && (
                      <button
                        onClick={() => onEdit(member)}
                        className="text-xs text-brand-600 font-medium px-2 py-1 rounded-lg bg-brand-50"
                      >
                        Роль
                      </button>
                    )}
                    {canRemove && (
                      <button
                        onClick={() => onRemove(member)}
                        className="text-xs text-danger font-medium px-2 py-1 rounded-lg bg-red-50"
                      >
                        Убрать
                      </button>
                    )}
                  </div>
                }
              />
            )
          })}
        </div>
      </CardSection>
    </Section>
  )
}

function InviteCodeCard({
  role,
  code,
  loading,
  onRegenerate,
}: {
  role: ShopUserRole
  code: ShopInviteCode | null
  loading: boolean
  onRegenerate: () => void
}) {
  return (
    <div className="rounded-2xl border border-surface-border bg-surface px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">{SHOP_ROLE_LABELS[role]}</p>
          <p className="mt-1 text-sm text-ink-secondary">
            {code ? 'Действующий код для подключения сотрудников' : 'Код пока не создан'}
          </p>
        </div>
        <Badge variant={ROLE_BADGE_VARIANTS[role]}>{SHOP_ROLE_LABELS[role]}</Badge>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="rounded-2xl border border-dashed border-brand-300 bg-brand-50 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">Код</p>
          <p className="mt-1 text-2xl font-bold tracking-[0.24em] text-brand-700">
            {code?.code ?? '--------'}
          </p>
        </div>
        <Button size="sm" loading={loading} onClick={onRegenerate}>
          {code ? 'Перевыпустить' : 'Создать'}
        </Button>
      </div>
    </div>
  )
}

function StaffSkeleton() {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-surface border border-surface-border overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 border-b border-surface-border animate-pulse bg-surface-muted last:border-0" />
        ))}
      </div>
      <div className="rounded-2xl bg-surface border border-surface-border overflow-hidden">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 border-b border-surface-border animate-pulse bg-surface-muted last:border-0" />
        ))}
      </div>
    </div>
  )
}
