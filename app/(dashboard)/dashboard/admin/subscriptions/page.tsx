'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import FormField from '@/components/ui/FormField'
import { toast } from '@/components/ui/Toast'
import DataTable, { type ColumnDef } from '@/components/dashboard/DataTable'
import DialogShell from '@/components/dashboard/DialogShell'
import FilterBar from '@/components/dashboard/FilterBar'
import FilterChip from '@/components/dashboard/FilterChip'
import SearchInput from '@/components/dashboard/SearchInput'
import { normalizeAdminShopRecords, daysLeft, type AdminShopRecord } from '@/lib/dashboard/adminShopUtils'
import type { SubPlan, SubStatus } from '@/lib/types'
import { formatDate } from '@/lib/utils'

type SubscriptionRow = {
  shop_id: string
  shop_name: string
  plan: SubPlan
  status: SubStatus
  expires_at: string
  days_left: number
}

const STATUS_FILTERS: Array<'all' | SubStatus> = ['all', 'trial', 'active', 'expired', 'suspended']

const STATUS_LABELS: Record<SubStatus, string> = {
  trial: 'Пробный',
  active: 'Активная',
  expired: 'Истекла',
  suspended: 'Заблокирована',
}

const STATUS_VARIANTS: Record<SubStatus, 'warning' | 'success' | 'danger' | 'neutral'> = {
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

export default function DashboardAdminSubscriptionsPage() {
  const router = useRouter()
  const [shops, setShops] = useState<AdminShopRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | SubStatus>('all')
  const [search, setSearch] = useState('')

  const [editTarget, setEditTarget] = useState<SubscriptionRow | null>(null)
  const [editForm, setEditForm] = useState<{ status: SubStatus; plan: SubPlan; expires_at: string }>({
    status: 'trial',
    plan: 'trial',
    expires_at: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const res = await fetch('/api/admin/shops', { cache: 'no-store' }).then((response) => response.json())
        if (cancelled) return

        if (res.error) {
          setError(res.error.message)
          return
        }

        setShops(res.data ?? [])
      } catch {
        if (!cancelled) setError('Не удалось загрузить подписки')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const rows = useMemo<SubscriptionRow[]>(() => {
    return normalizeAdminShopRecords(shops)
      .filter((shop) => Boolean(shop.subscription))
      .map((shop) => ({
        shop_id: shop.id,
        shop_name: shop.name,
        plan: shop.subscription!.plan,
        status: shop.subscription!.status,
        expires_at: shop.subscription!.expires_at,
        days_left: daysLeft(shop.subscription!.expires_at),
      }))
      .filter((row) => {
        if (statusFilter !== 'all' && row.status !== statusFilter) return false
        const needle = search.trim().toLowerCase()
        if (!needle) return true

        return row.shop_name.toLowerCase().includes(needle)
      })
  }, [search, shops, statusFilter])

  const counts = useMemo(() => ({
    all: rows.length,
    trial: rows.filter((row) => row.status === 'trial').length,
    active: rows.filter((row) => row.status === 'active').length,
    expired: rows.filter((row) => row.status === 'expired').length,
    suspended: rows.filter((row) => row.status === 'suspended').length,
  }), [rows])

  const columns: ColumnDef<SubscriptionRow>[] = [
    {
      key: 'shop_name',
      header: 'Заведение',
      sortable: true,
      render: (row) => row.shop_name,
    },
    {
      key: 'plan',
      header: 'Тариф',
      sortable: true,
      render: (row) => <Badge variant="neutral">{PLAN_LABELS[row.plan]}</Badge>,
    },
    {
      key: 'status',
      header: 'Статус',
      sortable: true,
      render: (row) => <Badge variant={STATUS_VARIANTS[row.status]}>{STATUS_LABELS[row.status]}</Badge>,
    },
    {
      key: 'expires_at',
      header: 'Истекает',
      sortable: true,
      render: (row) => formatDate(row.expires_at),
    },
    {
      key: 'days_left',
      header: 'Дней',
      sortable: true,
      render: (row) => (
        <span className={row.days_left < 7 ? 'font-semibold text-danger' : 'text-ink'}>
          {row.days_left}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={(event) => {
              event.stopPropagation()
              void extendSubscription(row, 30, setShops)
            }}
          >
            +30д
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(event) => {
              event.stopPropagation()
              void extendSubscription(row, 365, setShops)
            }}
          >
            +365д
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(event) => {
              event.stopPropagation()
              setEditTarget(row)
              setEditForm({
                status: row.status,
                plan: row.plan,
                expires_at: row.expires_at.slice(0, 10),
              })
            }}
          >
            Изменить
          </Button>
        </div>
      ),
    },
  ]

  async function handleSave() {
    if (!editTarget) return

    setSaving(true)
    try {
      const res = await fetch(`/api/admin/subscriptions/${editTarget.shop_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      }).then((response) => response.json())

      if (res.error) {
        toast.error(res.error.message)
        return
      }

      toast.success('Подписка обновлена')
      setEditTarget(null)
      setShops((prev) => prev.map((shop) => {
        if (shop.id !== editTarget.shop_id) return shop
        return { ...shop, subscription: res.data }
      }))
    } catch {
      toast.error('Не удалось обновить подписку')
    } finally {
      setSaving(false)
    }
  }

  if (error) {
    return (
      <ErrorBlock
        title="Не удалось загрузить подписки"
        message={error}
        onRetry={() => window.location.reload()}
      />
    )
  }

  return (
    <>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section>
          <h1 className="text-3xl font-bold text-ink">Подписки</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-secondary">
            Управление планами, сроками действия и статусами подписок по всем заведениям платформы.
          </p>
        </section>

        <FilterBar>
          <div className="flex flex-1 flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {STATUS_FILTERS.map((filter) => (
                <FilterChip
                  key={filter}
                  label={filter === 'all' ? 'Все' : STATUS_LABELS[filter]}
                  count={counts[filter]}
                  active={statusFilter === filter}
                  onClick={() => setStatusFilter(filter)}
                />
              ))}
            </div>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Поиск по заведению"
              className="w-full max-w-md"
            />
          </div>
        </FilterBar>

        <DataTable
          columns={columns}
          data={rows}
          keyField="shop_id"
          loading={loading}
          emptyText="Подписки по выбранным фильтрам не найдены"
          onRowClick={(row) => router.push(`/dashboard/admin/restaurants/${row.shop_id}`)}
          pageSize={12}
        />
      </div>

      {editTarget && (
        <DialogShell title="Изменить подписку" onClose={() => !saving && setEditTarget(null)} maxWidthClassName="max-w-lg">
          <div className="space-y-4">
            <FormField
              as="select"
              label="Статус"
              value={editForm.status}
              onChange={(value) => setEditForm((prev) => ({ ...prev, status: value as SubStatus }))}
            >
              <option value="trial">Пробный</option>
              <option value="active">Активная</option>
              <option value="expired">Истекла</option>
              <option value="suspended">Заблокирована</option>
            </FormField>
            <FormField
              as="select"
              label="Тариф"
              value={editForm.plan}
              onChange={(value) => setEditForm((prev) => ({ ...prev, plan: value as SubPlan }))}
            >
              <option value="trial">Пробный</option>
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
            </FormField>
            <FormField
              label="Дата окончания"
              type="date"
              value={editForm.expires_at}
              onChange={(value) => setEditForm((prev) => ({ ...prev, expires_at: value }))}
            />
            <div className="flex justify-end">
              <Button loading={saving} onClick={handleSave}>
                Сохранить
              </Button>
            </div>
          </div>
        </DialogShell>
      )}
    </>
  )
}

async function extendSubscription(
  row: SubscriptionRow,
  daysToAdd: number,
  setShops: React.Dispatch<React.SetStateAction<AdminShopRecord[]>>,
) {
  try {
    const nextDate = new Date(row.expires_at)
    nextDate.setDate(nextDate.getDate() + daysToAdd)

    const res = await fetch(`/api/admin/subscriptions/${row.shop_id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expires_at: nextDate.toISOString() }),
    }).then((response) => response.json())

    if (res.error) {
      toast.error(res.error.message)
      return
    }

    toast.success(`Подписка продлена на ${daysToAdd} дней`)
    setShops((prev) => prev.map((shop) => {
      if (shop.id !== row.shop_id) return shop
      return { ...shop, subscription: res.data }
    }))
  } catch {
    toast.error('Не удалось продлить подписку')
  }
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
