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
import { normalizeAdminShopRecords, daysLeft, getShopOwnerName, type AdminShopRecord } from '@/lib/dashboard/adminShopUtils'
import type { SubStatus } from '@/lib/types'
import { formatDate } from '@/lib/utils'

type ShopRow = ReturnType<typeof normalizeAdminShopRecords>[number] & {
  owner: string
  plan: string
  sub_status: SubStatus | 'none'
  days_left: number | null
  members_count: number
}

const STATUS_LABELS: Record<SubStatus | 'none', string> = {
  trial: 'Пробный',
  active: 'Активная',
  expired: 'Истекла',
  suspended: 'Заблокирована',
  none: 'Нет подписки',
}

const STATUS_VARIANTS: Record<SubStatus | 'none', 'warning' | 'success' | 'danger' | 'neutral'> = {
  trial: 'warning',
  active: 'success',
  expired: 'danger',
  suspended: 'neutral',
  none: 'neutral',
}

const STATUS_FILTERS: Array<'all' | SubStatus> = ['all', 'trial', 'active', 'expired', 'suspended']

const EMPTY_FORM = {
  name: '',
  address: '',
  phone: '',
}

export default function DashboardAdminRestaurantsPage() {
  const router = useRouter()
  const [shops, setShops] = useState<AdminShopRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | SubStatus>('all')
  const [search, setSearch] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
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
        if (!cancelled) setError('Не удалось загрузить заведения')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const rows = useMemo<ShopRow[]>(() => {
    const normalized = normalizeAdminShopRecords(shops)

    return normalized
      .map((shop) => ({
        ...shop,
        owner: getShopOwnerName(shop),
        plan: shop.subscription?.plan ?? '—',
        sub_status: (shop.subscription?.status ?? 'none') as SubStatus | 'none',
        days_left: shop.subscription ? daysLeft(shop.subscription.expires_at) : null,
        members_count: shop.members.length,
      }))
      .filter((shop) => {
        if (statusFilter !== 'all' && shop.sub_status !== statusFilter) return false
        const needle = search.trim().toLowerCase()
        if (!needle) return true

        return (
          shop.name.toLowerCase().includes(needle) ||
          shop.owner.toLowerCase().includes(needle) ||
          (shop.address?.toLowerCase().includes(needle) ?? false)
        )
      })
  }, [search, shops, statusFilter])

  const counts = useMemo(() => {
    const normalized = normalizeAdminShopRecords(shops)
    return {
      all: normalized.length,
      trial: normalized.filter((shop) => shop.subscription?.status === 'trial').length,
      active: normalized.filter((shop) => shop.subscription?.status === 'active').length,
      expired: normalized.filter((shop) => shop.subscription?.status === 'expired').length,
      suspended: normalized.filter((shop) => shop.subscription?.status === 'suspended').length,
    }
  }, [shops])

  const columns: ColumnDef<ShopRow>[] = [
    {
      key: 'name',
      header: 'Название',
      sortable: true,
      render: (row) => (
        <div>
          <p className="font-semibold text-ink">{row.name}</p>
          <p className="mt-1 text-xs text-ink-secondary">{row.address ?? 'Адрес не указан'}</p>
        </div>
      ),
    },
    {
      key: 'owner',
      header: 'Владелец',
      sortable: true,
      render: (row) => row.owner,
    },
    {
      key: 'plan',
      header: 'Тариф',
      sortable: true,
      render: (row) => <Badge variant="neutral">{row.plan}</Badge>,
    },
    {
      key: 'sub_status',
      header: 'Подписка',
      sortable: true,
      render: (row) => <Badge variant={STATUS_VARIANTS[row.sub_status]}>{STATUS_LABELS[row.sub_status]}</Badge>,
    },
    {
      key: 'days_left',
      header: 'Дней',
      sortable: true,
      render: (row) => (
        <span className={row.days_left !== null && row.days_left < 7 ? 'font-semibold text-danger' : 'text-ink'}>
          {row.days_left === null ? '—' : row.days_left}
        </span>
      ),
    },
    {
      key: 'members_count',
      header: 'Сотрудников',
      sortable: true,
      render: (row) => row.members_count,
    },
    {
      key: 'created_at',
      header: 'Создано',
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
              router.push(`/dashboard/admin/restaurants/${row.id}`)
            }}
          >
            Открыть
          </Button>
        </div>
      ),
    },
  ]

  async function handleCreate() {
    if (!form.name.trim()) {
      toast.error('Введите название заведения')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/admin/shops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          address: form.address.trim() || undefined,
          phone: form.phone.trim() || undefined,
        }),
      }).then((response) => response.json())

      if (res.error) {
        toast.error(res.error.message)
        return
      }

      toast.success('Заведение создано')
      setCreateOpen(false)
      setForm(EMPTY_FORM)
      setShops((prev) => [res.data, ...prev])
    } catch {
      toast.error('Не удалось создать заведение')
    } finally {
      setSaving(false)
    }
  }

  if (error) {
    return (
      <ErrorBlock
        title="Не удалось загрузить список заведений"
        message={error}
        onRetry={() => window.location.reload()}
      />
    )
  }

  return (
    <>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section>
          <h1 className="text-3xl font-bold text-ink">Заведения</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-secondary">
            Реестр всех ресторанов платформы: owner, подписка, срок действия и состав персонала.
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
              placeholder="Поиск по названию, владельцу или адресу"
              className="w-full max-w-md"
            />
          </div>
          <Button onClick={() => setCreateOpen(true)}>Создать заведение</Button>
        </FilterBar>

        <DataTable
          columns={columns}
          data={rows}
          keyField="id"
          loading={loading}
          emptyText="Заведений по выбранным фильтрам пока нет"
          onRowClick={(row) => router.push(`/dashboard/admin/restaurants/${row.id}`)}
          pageSize={12}
        />
      </div>

      {createOpen && (
        <DialogShell
          title="Новое заведение"
          description="Создаёт запись ресторана и автоматически запускает trial-подписку на 30 дней."
          onClose={() => {
            if (saving) return
            setCreateOpen(false)
            setForm(EMPTY_FORM)
          }}
          maxWidthClassName="max-w-lg"
        >
          <div className="space-y-4">
            <FormField
              label="Название"
              required
              value={form.name}
              onChange={(value) => setForm((prev) => ({ ...prev, name: value }))}
            />
            <FormField
              label="Адрес"
              value={form.address}
              onChange={(value) => setForm((prev) => ({ ...prev, address: value }))}
            />
            <FormField
              label="Телефон"
              type="tel"
              value={form.phone}
              onChange={(value) => setForm((prev) => ({ ...prev, phone: value }))}
            />
            <div className="flex justify-end">
              <Button loading={saving} onClick={handleCreate}>
                Создать заведение
              </Button>
            </div>
          </div>
        </DialogShell>
      )}
    </>
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
