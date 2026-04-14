'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import DataTable, { type ColumnDef } from '@/components/dashboard/DataTable'
import FilterBar from '@/components/dashboard/FilterBar'
import FilterChip from '@/components/dashboard/FilterChip'
import SearchInput from '@/components/dashboard/SearchInput'
import FormField from '@/components/ui/FormField'
import { toast } from '@/components/ui/Toast'
import type { OwnerApplication, OwnerApplicationStatus, ShopUserRole, UserRole } from '@/lib/types'
import { formatDate } from '@/lib/utils'

interface AdminUserRow {
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
    shop: { id: string; name: string; is_active: boolean } | null
  }>
}

interface ShopOption {
  id: string
  name: string
  is_active: boolean
}

const ROLE_FILTERS: Array<'all' | UserRole> = ['all', 'super_admin', 'unauthorized', 'owner', 'manager', 'waiter', 'kitchen']

const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Супер-админ',
  unauthorized: 'Не авторизован',
  owner: 'Владелец',
  manager: 'Менеджер',
  waiter: 'Официант',
  kitchen: 'Кухня',
}

const ROLE_VARIANTS: Record<UserRole, 'danger' | 'default' | 'info' | 'warning' | 'neutral'> = {
  super_admin: 'danger',
  unauthorized: 'neutral',
  owner: 'default',
  manager: 'info',
  waiter: 'info',
  kitchen: 'warning',
}

const APPLICATION_STATUS_LABELS: Record<OwnerApplicationStatus, string> = {
  pending: 'Новая',
  contacted: 'Связались',
  approved: 'Одобрено',
  rejected: 'Отклонено',
}

export default function DashboardAdminUsersPage() {
  const router = useRouter()
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [shops, setShops] = useState<ShopOption[]>([])
  const [applications, setApplications] = useState<OwnerApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [metaLoading, setMetaLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all')
  const [search, setSearch] = useState('')
  const [identifier, setIdentifier] = useState('')
  const [createRole, setCreateRole] = useState<UserRole>('waiter')
  const [createShopRole, setCreateShopRole] = useState<ShopUserRole>('waiter')
  const [selectedShopId, setSelectedShopId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [updatingApplicationId, setUpdatingApplicationId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadUsers() {
      setLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams()
        if (roleFilter !== 'all') params.set('role', roleFilter)
        if (search.trim()) params.set('search', search.trim())

        const res = await fetch(`/api/admin/users?${params.toString()}`, {
          cache: 'no-store',
        }).then((response) => response.json())

        if (cancelled) return
        if (res.error) {
          setError(res.error.message)
          return
        }

        setUsers(res.data ?? [])
      } catch {
        if (!cancelled) setError('Не удалось загрузить пользователей')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadUsers()
    return () => {
      cancelled = true
    }
  }, [roleFilter, search])

  useEffect(() => {
    let cancelled = false

    async function loadMeta({ silent = false } = {}) {
      if (!silent) setMetaLoading(true)

      try {
        const [shopsRes, applicationsRes] = await Promise.all([
          fetch('/api/admin/shops', { cache: 'no-store' }).then((response) => response.json()),
          fetch('/api/admin/owner-applications', { cache: 'no-store' }).then((response) => response.json()),
        ])

        if (cancelled) return

        if (shopsRes.error) {
          setError(shopsRes.error.message)
          return
        }
        if (applicationsRes.error) {
          setError(applicationsRes.error.message)
          return
        }

        const nextShops: ShopOption[] = (shopsRes.data ?? []).map((shop: { id: string; name: string; is_active: boolean }) => ({
          id: shop.id,
          name: shop.name,
          is_active: shop.is_active,
        }))

        setShops(nextShops)
        setApplications(applicationsRes.data ?? [])
        setSelectedShopId((current) => current || nextShops[0]?.id || '')
      } catch {
        if (!cancelled) setError('Не удалось загрузить данные админки')
      } finally {
        if (!cancelled && !silent) setMetaLoading(false)
      }
    }

    function handleRefreshSignal() {
      if (document.visibilityState === 'visible') {
        void loadMeta({ silent: true })
      }
    }

    void loadMeta()

    const intervalId = window.setInterval(() => {
      void loadMeta({ silent: true })
    }, 15000)

    window.addEventListener('focus', handleRefreshSignal)
    document.addEventListener('visibilitychange', handleRefreshSignal)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
      window.removeEventListener('focus', handleRefreshSignal)
      document.removeEventListener('visibilitychange', handleRefreshSignal)
    }
  }, [])

  useEffect(() => {
    if (createRole === 'super_admin' || createRole === 'unauthorized') return
    setCreateShopRole(inferShopRole(createRole))
  }, [createRole])

  const counts = useMemo(() => ({
    all: users.length,
    super_admin: users.filter((user) => user.role === 'super_admin').length,
    unauthorized: users.filter((user) => user.role === 'unauthorized').length,
    owner: users.filter((user) => user.role === 'owner').length,
    manager: users.filter((user) => user.role === 'manager').length,
    waiter: users.filter((user) => user.role === 'waiter').length,
    kitchen: users.filter((user) => user.role === 'kitchen').length,
  }), [users])

  const pendingApplications = useMemo(
    () => applications.filter((item) => item.status === 'pending'),
    [applications],
  )

  async function handleQuickAdd() {
    if (!identifier.trim()) {
      toast.error('Введите username или Telegram ID')
      return
    }

    if (createRole !== 'super_admin' && createRole !== 'unauthorized' && !selectedShopId) {
      toast.error('Выберите заведение')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: identifier.trim(),
          role: createRole,
          shop_id: createRole === 'super_admin' || createRole === 'unauthorized' ? null : selectedShopId,
          shop_role: createRole === 'super_admin' || createRole === 'unauthorized' ? null : createShopRole,
        }),
      }).then((response) => response.json())

      if (res.error) {
        toast.error(res.error.message)
        return
      }

      const nextUser = res.data as AdminUserRow
      setUsers((prev) => [nextUser, ...prev.filter((item) => item.id !== nextUser.id)])
      setIdentifier('')
      toast.success('Пользователь готов к назначению')
      router.push(`/dashboard/admin/users/${nextUser.id}`)
    } catch {
      toast.error('Не удалось подключить пользователя')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleApplicationStatus(id: string, status: OwnerApplicationStatus) {
    setUpdatingApplicationId(id)
    try {
      const res = await fetch(`/api/admin/owner-applications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      }).then((response) => response.json())

      if (res.error) {
        toast.error(res.error.message)
        return
      }

      setApplications((prev) => prev.map((item) => item.id === id ? res.data : item))
      toast.success(`Заявка обновлена: ${APPLICATION_STATUS_LABELS[status]}`)
    } catch {
      toast.error('Не удалось обновить заявку')
    } finally {
      setUpdatingApplicationId(null)
    }
  }

  const columns: ColumnDef<AdminUserRow>[] = [
    {
      key: 'name',
      header: 'Имя',
      sortable: true,
      render: (row) => (
        <div>
          <p className="font-semibold text-ink">{row.name}</p>
          <p className="mt-1 text-xs text-ink-secondary">
            {row.username ? `@${row.username}` : 'Без username'}
          </p>
        </div>
      ),
    },
    {
      key: 'telegram_id',
      header: 'Telegram ID',
      sortable: true,
      render: (row) => <span className="font-mono text-xs">{row.telegram_id}</span>,
    },
    {
      key: 'role',
      header: 'Роль',
      sortable: true,
      render: (row) => <Badge variant={ROLE_VARIANTS[row.role]}>{ROLE_LABELS[row.role]}</Badge>,
    },
    {
      key: 'shops',
      header: 'Заведения',
      render: (row) => {
        const names = (row.shops ?? [])
          .map((membership) => membership.shop?.name)
          .filter((name): name is string => Boolean(name))
        if (names.length === 0) return '—'
        return names.join(', ')
      },
    },
    {
      key: 'created_at',
      header: 'Зарегистрирован',
      sortable: true,
      render: (row) => formatDate(row.created_at),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={(event) => {
              event.stopPropagation()
              router.push(`/dashboard/admin/users/${row.id}`)
            }}
          >
            Открыть
          </Button>
        </div>
      ),
    },
  ]

  if (error) {
    return (
      <ErrorBlock
        title="Не удалось загрузить пользователей"
        message={error}
        onRetry={() => window.location.reload()}
      />
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <section>
        <h1 className="text-3xl font-bold text-ink">Пользователи</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-secondary">
          Управление платформенными пользователями, их текущими ролями и привязками к заведениям.
        </p>
      </section>

      <section className="rounded-3xl border border-surface-border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-ink">Быстрое подключение пользователя</h2>
          <p className="text-sm text-ink-secondary">
            По `Telegram ID` можно сразу завести нового пользователя в систему. По `username` можно найти и назначить только того, кто уже заходил в mini app.
          </p>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_1fr_1fr_1fr_auto]">
          <FormField
            label="Username или Telegram ID"
            value={identifier}
            onChange={setIdentifier}
            placeholder="@username или 123456789"
          />
          <FormField
            as="select"
            label="Роль"
            value={createRole}
            onChange={(value) => setCreateRole(value as UserRole)}
          >
            <option value="super_admin">Супер-админ</option>
            <option value="unauthorized">Не авторизован</option>
            <option value="owner">Владелец</option>
            <option value="manager">Менеджер</option>
            <option value="waiter">Официант</option>
            <option value="kitchen">Кухня</option>
          </FormField>
          <FormField
            as="select"
            label="Заведение"
            value={selectedShopId}
            onChange={setSelectedShopId}
            disabled={createRole === 'super_admin' || createRole === 'unauthorized' || metaLoading}
          >
            <option value="">Выберите заведение</option>
            {shops.map((shop) => (
              <option key={shop.id} value={shop.id}>
                {shop.name}
              </option>
            ))}
          </FormField>
          <FormField
            as="select"
            label="Shop role"
            value={createShopRole}
            onChange={(value) => setCreateShopRole(value as ShopUserRole)}
            disabled={createRole === 'super_admin' || createRole === 'unauthorized'}
          >
            <option value="owner">Владелец</option>
            <option value="manager">Менеджер</option>
            <option value="waiter">Официант</option>
            <option value="kitchen">Кухня</option>
          </FormField>
          <div className="flex items-end">
            <Button loading={submitting} onClick={handleQuickAdd}>
              Найти / добавить
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-surface-border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">Заявки на подключение</h2>
            <p className="mt-1 text-sm text-ink-secondary">
              Новых заявок: <strong className="text-ink">{pendingApplications.length}</strong>
            </p>
          </div>
        </div>
        {applications.length === 0 ? (
          <p className="mt-4 text-sm text-ink-muted">Заявок пока нет.</p>
        ) : (
          <div className="mt-4 grid gap-3">
            {applications.slice(0, 6).map((application) => (
              <div
                key={application.id}
                className="rounded-2xl border border-surface-border bg-surface-muted px-4 py-4"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold text-ink">{application.restaurant_name}</p>
                      <Badge variant={application.status === 'pending' ? 'warning' : application.status === 'approved' ? 'default' : application.status === 'contacted' ? 'info' : 'neutral'}>
                        {APPLICATION_STATUS_LABELS[application.status]}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-ink-secondary">
                      {application.applicant_name} · {application.phone}
                    </p>
                    <p className="mt-1 text-xs text-ink-muted">
                      {application.user?.username ? `@${application.user.username}` : `Telegram ID: ${application.telegram_id}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setSearch(application.user?.username ?? String(application.telegram_id))}
                    >
                      Найти в пользователях
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={updatingApplicationId === application.id}
                      onClick={() => handleApplicationStatus(application.id, 'contacted')}
                    >
                      Связались
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={updatingApplicationId === application.id}
                      onClick={() => handleApplicationStatus(application.id, 'approved')}
                    >
                      Одобрить
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <FilterBar>
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {ROLE_FILTERS.map((filter) => (
              <FilterChip
                key={filter}
                label={filter === 'all' ? 'Все' : ROLE_LABELS[filter]}
                count={counts[filter]}
                active={roleFilter === filter}
                onClick={() => setRoleFilter(filter)}
              />
            ))}
          </div>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Поиск по имени, username или Telegram ID"
            className="w-full max-w-md"
          />
        </div>
      </FilterBar>

      <DataTable
        columns={columns}
        data={users}
        keyField="id"
        loading={loading}
        emptyText="Пользователи по выбранным фильтрам не найдены"
        onRowClick={(row) => router.push(`/dashboard/admin/users/${row.id}`)}
        pageSize={12}
      />
    </div>
  )
}

function inferShopRole(role: UserRole): ShopUserRole {
  if (role === 'owner' || role === 'manager' || role === 'waiter' || role === 'kitchen') {
    return role
  }

  return 'waiter'
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
