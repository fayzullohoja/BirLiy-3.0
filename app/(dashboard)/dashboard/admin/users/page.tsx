'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import DataTable, { type ColumnDef } from '@/components/dashboard/DataTable'
import FilterBar from '@/components/dashboard/FilterBar'
import FilterChip from '@/components/dashboard/FilterChip'
import SearchInput from '@/components/dashboard/SearchInput'
import type { ShopUserRole, UserRole } from '@/lib/types'
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

export default function DashboardAdminUsersPage() {
  const router = useRouter()
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
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

    void load()
    return () => {
      cancelled = true
    }
  }, [roleFilter, search])

  const counts = useMemo(() => ({
    all: users.length,
    super_admin: users.filter((user) => user.role === 'super_admin').length,
    unauthorized: users.filter((user) => user.role === 'unauthorized').length,
    owner: users.filter((user) => user.role === 'owner').length,
    manager: users.filter((user) => user.role === 'manager').length,
    waiter: users.filter((user) => user.role === 'waiter').length,
    kitchen: users.filter((user) => user.role === 'kitchen').length,
  }), [users])

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
            placeholder="Поиск по имени или username"
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
