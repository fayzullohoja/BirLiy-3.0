'use client'

import { useCallback, useEffect, useState } from 'react'
import AppHeader from '@/components/layout/AppHeader'
import PageContainer, { Section, EmptyState } from '@/components/ui/PageContainer'
import { CardSection, ListItem } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { useOwnerSession } from '../_context/OwnerSessionContext'
import type { ShopUser } from '@/lib/types'

const ROLE_LABELS: Record<string, string> = {
  waiter: 'Официант',
  owner:  'Владелец',
}

function initials(name: string) {
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
}

export default function OwnerStaffPage() {
  const session = useOwnerSession()

  const [staff, setStaff]           = useState<ShopUser[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [deleteTarget, setDelete]   = useState<ShopUser | null>(null)
  const [deleting, setDeleting]     = useState(false)

  const fetchStaff = useCallback(() => {
    if (session.loading) return
    setLoading(true)
    fetch(`/api/staff?shop_id=${session.primaryShopId}`)
      .then(r => r.json())
      .then(res => {
        if (res.error) setError(res.error.message)
        else setStaff(res.data ?? [])
      })
      .catch(() => setError('Не удалось загрузить персонал'))
      .finally(() => setLoading(false))
  }, [session.loading, session.primaryShopId])

  useEffect(() => { fetchStaff() }, [fetchStaff])

  async function handleRemove() {
    if (!deleteTarget?.user) return
    setDeleting(true)
    await fetch(
      `/api/staff?shop_id=${session.primaryShopId}&user_id=${deleteTarget.user.id}`,
      { method: 'DELETE' },
    ).finally(() => setDeleting(false))
    setDelete(null)
    fetchStaff()
  }

  const waiters = staff.filter(s => s.role === 'waiter')
  const owners  = staff.filter(s => s.role === 'owner')

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
        ) : staff.length === 0 ? (
          <Section className="pt-4">
            <EmptyState
              title="Персонал не добавлен"
              description="Поделитесь ботом с официантами — при первом входе они автоматически появятся здесь после привязки"
            />
          </Section>
        ) : (
          <>
            {owners.length > 0 && (
              <Section title="Владельцы" className="pt-4">
                <CardSection>
                  <div className="divide-y divide-surface-border">
                    {owners.map(s => (
                      <StaffRow
                        key={s.id}
                        member={s}
                        canRemove={false}
                        onRemove={() => {}}
                      />
                    ))}
                  </div>
                </CardSection>
              </Section>
            )}

            {waiters.length > 0 && (
              <Section title="Официанты" className="pt-5 pb-6">
                <CardSection>
                  <div className="divide-y divide-surface-border">
                    {waiters.map(s => (
                      <StaffRow
                        key={s.id}
                        member={s}
                        canRemove={s.user?.id !== session.userId}
                        onRemove={() => setDelete(s)}
                      />
                    ))}
                  </div>
                </CardSection>
              </Section>
            )}
          </>
        )}

        {/* Info box about inviting */}
        {!loading && !error && (
          <div className="mx-4 mt-2 mb-6 p-4 rounded-2xl bg-blue-50 border border-blue-200">
            <p className="text-xs font-semibold text-blue-700 mb-1">Как добавить официанта?</p>
            <p className="text-xs text-blue-600">
              Поделитесь ссылкой на бот с официантом. При первом входе они появятся в системе. Привяжите их к ресторану через панель администратора.
            </p>
          </div>
        )}
      </PageContainer>

      {/* Remove confirmation */}
      <BottomSheet
        open={!!deleteTarget}
        onClose={() => setDelete(null)}
        title="Удалить сотрудника?"
      >
        <div className="px-4 py-4 flex flex-col gap-3">
          <p className="text-sm text-ink-secondary">
            Удалить <strong>{deleteTarget?.user?.name}</strong> из ресторана?
            Они потеряют доступ к приложению.
          </p>
          <button
            onClick={handleRemove}
            disabled={deleting}
            className="w-full py-3.5 rounded-2xl bg-danger text-white font-semibold text-sm disabled:opacity-50"
          >
            {deleting ? 'Удаляем...' : 'Удалить'}
          </button>
          <button onClick={() => setDelete(null)} className="w-full py-3 text-ink-secondary text-sm font-medium">
            Отмена
          </button>
        </div>
      </BottomSheet>
    </>
  )
}

// ─── Staff row ────────────────────────────────────────────────────────────────

function StaffRow({ member, canRemove, onRemove }: {
  member: ShopUser; canRemove: boolean; onRemove: () => void
}) {
  const user = member.user
  const name = user?.name ?? 'Без имени'

  return (
    <ListItem
      leading={
        <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
          <span className="text-xs font-bold text-brand-700">{initials(name)}</span>
        </div>
      }
      title={name}
      subtitle={user?.username ? `@${user.username}` : `ID: ${user?.telegram_id ?? '—'}`}
      trailing={
        <div className="flex items-center gap-2">
          <Badge variant="neutral">{ROLE_LABELS[member.role] ?? member.role}</Badge>
          {canRemove && (
            <button
              onClick={onRemove}
              className="text-xs text-danger font-medium px-2 py-1 rounded-lg bg-red-50"
            >
              Убрать
            </button>
          )}
        </div>
      }
    />
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function StaffSkeleton() {
  return (
    <div className="rounded-2xl bg-surface border border-surface-border overflow-hidden">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-14 border-b border-surface-border animate-pulse bg-surface-muted last:border-0" />
      ))}
    </div>
  )
}
