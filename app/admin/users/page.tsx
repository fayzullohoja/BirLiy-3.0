'use client'

import { useCallback, useEffect, useState } from 'react'
import AppHeader from '@/components/layout/AppHeader'
import PageContainer, { Section, EmptyState } from '@/components/ui/PageContainer'
import { CardSection, ListItem } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { toast } from '@/components/ui/Toast'
import type { AppUser, UserRole } from '@/lib/types'

// ─── Extended type ────────────────────────────────────────────────────────────

interface UserRow extends AppUser {
  shops: { id: string; role: string; shop: { id: string; name: string; is_active: boolean } | null }[]
}

// ─── Config ───────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Супер-Админ',
  owner:       'Владелец',
  waiter:      'Официант',
}

const ROLE_BADGE: Record<UserRole, 'danger' | 'info' | 'neutral'> = {
  super_admin: 'danger',
  owner:       'info',
  waiter:      'neutral',
}

const FILTER_OPTIONS: { value: '' | UserRole; label: string }[] = [
  { value: '',            label: 'Все' },
  { value: 'super_admin', label: 'Супер-Админ' },
  { value: 'owner',       label: 'Владельцы' },
  { value: 'waiter',      label: 'Официанты' },
]

function initials(name: string) {
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const [users, setUsers]           = useState<UserRow[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [roleFilter, setRoleFilter] = useState<'' | UserRole>('')

  // Role-change sheet
  const [editTarget, setEditTarget] = useState<UserRow | null>(null)
  const [newRole, setNewRole]       = useState<UserRole>('waiter')
  const [saving, setSaving]         = useState(false)
  const [saveError, setSaveError]   = useState<string | null>(null)

  const fetchUsers = useCallback(() => {
    setLoading(true)
    fetch(`/api/admin/users${roleFilter ? `?role=${roleFilter}` : ''}`)
      .then(r => r.json())
      .then(res => {
        if (res.error) setError(res.error.message)
        else setUsers(res.data ?? [])
      })
      .catch(() => setError('Не удалось загрузить пользователей'))
      .finally(() => setLoading(false))
  }, [roleFilter])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  function openEdit(user: UserRow) {
    setEditTarget(user)
    setNewRole(user.role)
    setSaveError(null)
  }

  async function handleSaveRole() {
    if (!editTarget) return
    setSaving(true); setSaveError(null)
    try {
      const res = await fetch(`/api/admin/users/${editTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      }).then(r => r.json())
      if (res.error) { setSaveError(res.error.message); return }
      setEditTarget(null)
      toast.success(`Роль «${editTarget.name}» обновлена`)
      fetchUsers()
    } finally { setSaving(false) }
  }

  return (
    <>
      <AppHeader
        title="Пользователи"
        subtitle={loading ? '' : `${users.length} пользователей`}
      />

      <PageContainer>
        {/* Role filter */}
        <div className="flex px-4 pt-4 gap-2 pb-3 overflow-x-auto scrollbar-hide">
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setRoleFilter(opt.value)}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                roleFilter === opt.value
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
            <UserSkeleton />
          ) : error ? (
            <EmptyState
              title="Ошибка загрузки"
              description={error}
              action={<Button variant="secondary" size="sm" onClick={fetchUsers}>Повторить</Button>}
            />
          ) : users.length === 0 ? (
            <EmptyState
              title="Нет пользователей"
              description="По этому фильтру никого не найдено"
            />
          ) : (
            <CardSection>
              <div className="divide-y divide-surface-border">
                {users.map(user => (
                  <ListItem
                    key={user.id}
                    leading={
                      <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-brand-700">{initials(user.name)}</span>
                      </div>
                    }
                    title={user.name}
                    subtitle={
                      user.username
                        ? `@${user.username} · ${user.shops?.length ?? 0} завед.`
                        : `ID: ${user.telegram_id} · ${user.shops?.length ?? 0} завед.`
                    }
                    trailing={
                      <div className="flex items-center gap-2">
                        <Badge variant={ROLE_BADGE[user.role] ?? 'neutral'}>
                          {ROLE_LABELS[user.role] ?? user.role}
                        </Badge>
                        <button
                          onClick={() => openEdit(user)}
                          className="text-xs text-brand-600 font-semibold px-2.5 py-1 rounded-xl bg-brand-50"
                        >
                          Роль
                        </button>
                      </div>
                    }
                  />
                ))}
              </div>
            </CardSection>
          )}
        </Section>
      </PageContainer>

      {/* Edit role sheet */}
      <BottomSheet open={!!editTarget} onClose={() => setEditTarget(null)} title="Изменить роль">
        <div className="px-4 py-4 flex flex-col gap-3">
          <p className="text-sm text-ink-secondary">
            Пользователь: <strong className="text-ink">{editTarget?.name}</strong>
          </p>
          <div className="flex flex-col gap-2">
            {(['waiter', 'owner', 'super_admin'] as UserRole[]).map(r => (
              <button
                key={r}
                onClick={() => setNewRole(r)}
                className={`w-full py-3 rounded-xl border text-sm font-semibold transition-colors ${
                  newRole === r
                    ? 'border-brand-600 bg-brand-50 text-brand-700'
                    : 'border-surface-border bg-surface text-ink-secondary hover:bg-surface-muted'
                }`}
              >
                {ROLE_LABELS[r]}
              </button>
            ))}
          </div>
          {saveError && <p className="text-xs text-danger">{saveError}</p>}
          <Button
            fullWidth
            loading={saving}
            disabled={newRole === editTarget?.role}
            onClick={handleSaveRole}
          >
            Сохранить
          </Button>
          <Button variant="ghost" fullWidth onClick={() => setEditTarget(null)} disabled={saving}>
            Отмена
          </Button>
        </div>
      </BottomSheet>
    </>
  )
}

function UserSkeleton() {
  return (
    <div className="rounded-2xl bg-surface border border-surface-border overflow-hidden">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-14 border-b border-surface-border animate-pulse bg-surface-muted last:border-0" />
      ))}
    </div>
  )
}
