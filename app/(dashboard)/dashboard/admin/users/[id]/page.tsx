'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { CardSection } from '@/components/ui/Card'
import FormField from '@/components/ui/FormField'
import { toast } from '@/components/ui/Toast'
import { SkeletonCard, SkeletonRow } from '@/components/dashboard/Skeleton'
import type { ShopUserRole, UserRole } from '@/lib/types'
import { formatDate } from '@/lib/utils'

interface ShopOption {
  id: string
  name: string
  is_active: boolean
}

interface AdminUserDetail {
  id: string
  telegram_id: number
  name: string
  username: string | null
  role: UserRole
  created_at: string
  updated_at: string
  shops?: Array<{
    id: string
    role: ShopUserRole
    shop_id: string
    created_at?: string
    shop: {
      id: string
      name: string
      is_active: boolean
      subscription?: {
        status: string
        plan: string
        expires_at: string
      } | null
    } | null
  }>
}

const DEMO_SHOP_ID = '00000000-0000-0000-0000-000000000001'

const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Супер-админ',
  owner: 'Владелец',
  manager: 'Менеджер',
  waiter: 'Официант',
  kitchen: 'Кухня',
}

const ROLE_VARIANTS: Record<UserRole, 'danger' | 'default' | 'info' | 'warning' | 'neutral'> = {
  super_admin: 'danger',
  owner: 'default',
  manager: 'info',
  waiter: 'info',
  kitchen: 'warning',
}

export default function DashboardAdminUserDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const userId = params.id

  const [user, setUser] = useState<AdminUserDetail | null>(null)
  const [shops, setShops] = useState<ShopOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [role, setRole] = useState<UserRole>('waiter')
  const [shopId, setShopId] = useState('')
  const [shopRole, setShopRole] = useState<ShopUserRole>('waiter')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const [userRes, shopsRes] = await Promise.all([
          fetch(`/api/admin/users/${userId}`, { cache: 'no-store' }).then((response) => response.json()),
          fetch('/api/admin/shops', { cache: 'no-store' }).then((response) => response.json()),
        ])

        if (cancelled) return

        if (userRes.error) {
          setError(userRes.error.message)
          return
        }
        if (shopsRes.error) {
          setError(shopsRes.error.message)
          return
        }

        const nextUser = userRes.data as AdminUserDetail
        const nextShops: ShopOption[] = (shopsRes.data ?? []).map((shop: { id: string; name: string; is_active: boolean }) => ({
          id: shop.id,
          name: shop.name,
          is_active: shop.is_active,
        }))

        setUser(nextUser)
        setShops(nextShops)
        setRole(nextUser.role)

        const primaryMembership = nextUser.shops?.[0] ?? null
        const defaultShopId = primaryMembership?.shop_id
          || nextShops.find((shop) => shop.id === DEMO_SHOP_ID)?.id
          || nextShops[0]?.id
          || ''

        setShopId(defaultShopId)
        setShopRole(primaryMembership?.role ?? inferShopRole(nextUser.role))
      } catch {
        if (!cancelled) setError('Не удалось загрузить пользователя')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [userId])

  const memberships = useMemo(() => user?.shops ?? [], [user?.shops])

  async function handleSave() {
    if (role !== 'super_admin' && !shopId) {
      toast.error('Выберите заведение для назначения')
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          shop_id: role === 'super_admin' ? null : shopId,
          shop_role: role === 'super_admin' ? null : shopRole,
        }),
      }).then((response) => response.json())

      if (res.error) {
        toast.error(res.error.message)
        return
      }

      const nextUser = res.data as AdminUserDetail
      setUser(nextUser)
      setRole(nextUser.role)
      setShopId(nextUser.shops?.[0]?.shop_id ?? shopId)
      setShopRole(nextUser.shops?.[0]?.role ?? inferShopRole(nextUser.role))
      toast.success('Профиль пользователя обновлён')
    } catch {
      toast.error('Не удалось обновить пользователя')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <SkeletonCard className="h-32" />
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

  if (error || !user) {
    return (
      <ErrorBlock
        title="Не удалось открыть пользователя"
        message={error ?? 'Пользователь не найден'}
        onBack={() => router.push('/dashboard/admin/users')}
      />
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <section className="flex items-start justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => router.push('/dashboard/admin/users')}
            className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-ink-secondary hover:text-ink"
          >
            <BackIcon />
            К списку пользователей
          </button>
          <h1 className="text-3xl font-bold text-ink">{user.name}</h1>
          <p className="mt-2 text-sm text-ink-secondary">
            {user.username ? `@${user.username}` : 'Без username'} · Telegram ID: {user.telegram_id}
          </p>
        </div>
        <Badge variant={ROLE_VARIANTS[user.role]}>{ROLE_LABELS[user.role]}</Badge>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
        <CardSection title="Профиль">
          <div className="grid gap-4 p-5 md:grid-cols-2">
            <InfoItem label="Имя" value={user.name} />
            <InfoItem label="Username" value={user.username ? `@${user.username}` : '—'} />
            <InfoItem label="Telegram ID" value={String(user.telegram_id)} />
            <InfoItem label="Роль" value={ROLE_LABELS[user.role]} />
            <InfoItem label="Дата регистрации" value={formatDate(user.created_at)} />
            <InfoItem label="Обновлён" value={formatDate(user.updated_at)} />
          </div>
        </CardSection>

        <CardSection title="Изменить роль">
          <div className="space-y-4 p-5">
            <FormField
              as="select"
              label="Платформенная роль"
              value={role}
              onChange={(value) => {
                const nextRole = value as UserRole
                setRole(nextRole)
                if (nextRole !== 'super_admin') {
                  setShopRole(inferShopRole(nextRole))
                  if (!shopId) {
                    setShopId(
                      memberships[0]?.shop_id
                        || shops.find((shop) => shop.id === DEMO_SHOP_ID)?.id
                        || shops[0]?.id
                        || '',
                    )
                  }
                }
              }}
            >
              <option value="super_admin">Супер-админ</option>
              <option value="owner">Владелец</option>
              <option value="manager">Менеджер</option>
              <option value="waiter">Официант</option>
              <option value="kitchen">Кухня</option>
            </FormField>

            {role !== 'super_admin' && (
              <>
                <FormField
                  as="select"
                  label="Заведение"
                  value={shopId}
                  onChange={setShopId}
                >
                  <option value="">Выберите заведение</option>
                  {shops.map((shop) => (
                    <option key={shop.id} value={shop.id}>
                      {shop.name}{shop.id === DEMO_SHOP_ID ? ' (демо)' : ''}{!shop.is_active ? ' [неактивно]' : ''}
                    </option>
                  ))}
                </FormField>
                <FormField
                  as="select"
                  label="Роль в заведении"
                  value={shopRole}
                  onChange={(value) => setShopRole(value as ShopUserRole)}
                >
                  <option value="owner">Владелец</option>
                  <option value="manager">Менеджер</option>
                  <option value="waiter">Официант</option>
                  <option value="kitchen">Кухня</option>
                </FormField>
              </>
            )}

            <div className="flex justify-end">
              <Button loading={saving} onClick={handleSave}>
                Сохранить
              </Button>
            </div>
          </div>
        </CardSection>
      </div>

      <CardSection title="Членство в заведениях">
        {memberships.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-ink-secondary">
            Пользователь пока не привязан ни к одному заведению.
          </div>
        ) : (
          <div className="divide-y divide-surface-border">
            {memberships.map((membership) => (
              <div key={membership.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-ink">{membership.shop?.name ?? 'Заведение удалено'}</p>
                  <p className="mt-1 text-sm text-ink-secondary">
                    Назначен {membership.created_at ? formatDate(membership.created_at) : '—'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={membership.role === 'owner' ? 'default' : membership.role === 'kitchen' ? 'warning' : membership.role === 'manager' ? 'info' : 'info'}>
                    {membership.role === 'owner' ? 'Владелец' : membership.role === 'manager' ? 'Менеджер' : membership.role === 'kitchen' ? 'Кухня' : 'Официант'}
                  </Badge>
                  {!membership.shop?.is_active && <Badge variant="neutral">Неактивно</Badge>}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardSection>
    </div>
  )
}

function inferShopRole(role: UserRole): ShopUserRole {
  if (role === 'owner') return 'owner'
  if (role === 'manager') return 'manager'
  if (role === 'kitchen') return 'kitchen'
  return 'waiter'
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
          К списку пользователей
        </Button>
      </div>
    </div>
  )
}

function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  )
}
