'use client'

import { useEffect, useMemo, useState } from 'react'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import FormField from '@/components/ui/FormField'
import { toast } from '@/components/ui/Toast'
import ConfirmDialog from '@/components/dashboard/ConfirmDialog'
import DataTable, { type ColumnDef } from '@/components/dashboard/DataTable'
import DateRangePicker from '@/components/dashboard/DateRangePicker'
import FilterBar from '@/components/dashboard/FilterBar'
import FilterChip from '@/components/dashboard/FilterChip'
import { SkeletonCard } from '@/components/dashboard/Skeleton'
import { useDashboardSession } from '@/components/dashboard/DashboardSessionContext'
import type { BookingStatus, Table, TableBooking } from '@/lib/types'
import { formatDate, formatTime } from '@/lib/utils'

const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  confirmed: 'Подтверждено',
  seated: 'Гости на месте',
  cancelled: 'Отменено',
  no_show: 'Не пришли',
}

const BOOKING_STATUS_VARIANTS: Record<BookingStatus, 'warning' | 'success' | 'danger' | 'neutral'> = {
  confirmed: 'warning',
  seated: 'success',
  cancelled: 'danger',
  no_show: 'neutral',
}

const EMPTY_FORM = {
  guest_name: '',
  guest_phone: '',
  table_id: '',
  date: '',
  time: '19:00',
  party_size: '2',
  notes: '',
}

type BookingRow = TableBooking & {
  guest: string
  phone: string
  table_label: string
  date_label: string
  time_label: string
}

export default function DashboardOwnerBookingsPage() {
  const session = useDashboardSession()
  const [bookings, setBookings] = useState<TableBooking[]>([])
  const [tables, setTables] = useState<Table[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | BookingStatus>('all')
  const [from, setFrom] = useState(todayInTashkent())
  const [to, setTo] = useState(todayInTashkent())

  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const [statusTarget, setStatusTarget] = useState<TableBooking | null>(null)
  const [nextStatus, setNextStatus] = useState<BookingStatus>('confirmed')
  const [statusSaving, setStatusSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<TableBooking | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!session.selectedShopId) return

    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)

      try {
        const [bookingsRes, tablesRes] = await Promise.all([
          fetch(`/api/bookings?shop_id=${session.selectedShopId}`, { cache: 'no-store' }).then((response) => response.json()),
          fetch(`/api/tables?shop_id=${session.selectedShopId}`, { cache: 'no-store' }).then((response) => response.json()),
        ])

        if (cancelled) return

        if (bookingsRes.error) {
          setError(bookingsRes.error.message)
          return
        }
        if (tablesRes.error) {
          setError(tablesRes.error.message)
          return
        }

        setBookings(bookingsRes.data ?? [])
        setTables(tablesRes.data ?? [])
        setForm((prev) => ({
          ...prev,
          table_id: prev.table_id || tablesRes.data?.[0]?.id || '',
          date: prev.date || todayInTashkent(),
        }))
      } catch {
        if (!cancelled) setError('Не удалось загрузить бронирования')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [session.selectedShopId])

  const visibleRows = useMemo<BookingRow[]>(() => {
    return bookings
      .filter((booking) => {
        if (statusFilter !== 'all' && booking.status !== statusFilter) return false
        const date = toDateInput(booking.booked_at)
        return date >= from && date <= to
      })
      .sort((left, right) => new Date(left.booked_at).getTime() - new Date(right.booked_at).getTime())
      .map((booking) => ({
        ...booking,
        guest: booking.guest_name,
        phone: booking.guest_phone ?? '—',
        table_label: booking.table?.name ?? `Стол ${booking.table?.number ?? '—'}`,
        date_label: formatDate(booking.booked_at),
        time_label: formatTime(booking.booked_at),
      }))
  }, [bookings, from, statusFilter, to])

  const columns: ColumnDef<BookingRow>[] = [
    { key: 'guest', header: 'Гость', sortable: true, render: (row) => row.guest },
    { key: 'phone', header: 'Телефон', render: (row) => row.phone },
    { key: 'table_label', header: 'Стол', sortable: true, render: (row) => row.table_label },
    { key: 'date_label', header: 'Дата', sortable: true, render: (row) => row.date_label },
    { key: 'time_label', header: 'Время', sortable: true, render: (row) => row.time_label },
    {
      key: 'status',
      header: 'Статус',
      sortable: true,
      render: (row) => <Badge variant={BOOKING_STATUS_VARIANTS[row.status]}>{BOOKING_STATUS_LABELS[row.status]}</Badge>,
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
              setStatusTarget(row)
              setNextStatus(row.status)
            }}
          >
            Статус
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(event) => {
              event.stopPropagation()
              setDeleteTarget(row)
            }}
          >
            Удалить
          </Button>
        </div>
      ),
    },
  ]

  async function handleCreate() {
    if (!session.selectedShopId) return
    if (!form.guest_name.trim() || !form.table_id || !form.date || !form.time) {
      toast.error('Заполните обязательные поля бронирования')
      return
    }

    const partySize = Number.parseInt(form.party_size, 10)
    if (!Number.isInteger(partySize) || partySize < 1) {
      toast.error('Количество гостей должно быть положительным')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop_id: session.selectedShopId,
          table_id: form.table_id,
          guest_name: form.guest_name.trim(),
          guest_phone: form.guest_phone.trim() || null,
          party_size: partySize,
          booked_at: toIso(form.date, form.time),
          notes: form.notes.trim() || null,
        }),
      }).then((response) => response.json())

      if (res.error) {
        toast.error(res.error.message)
        return
      }

      setBookings((prev) => [...prev, res.data])
      setCreateOpen(false)
      setForm({
        ...EMPTY_FORM,
        table_id: tables[0]?.id ?? '',
        date: todayInTashkent(),
      })
      toast.success('Бронирование создано')
    } catch {
      toast.error('Не удалось создать бронирование')
    } finally {
      setSaving(false)
    }
  }

  async function handleStatusUpdate() {
    if (!statusTarget) return

    setStatusSaving(true)
    try {
      const res = await fetch(`/api/bookings/${statusTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      }).then((response) => response.json())

      if (res.error) {
        toast.error(res.error.message)
        return
      }

      setBookings((prev) => prev.map((booking) => booking.id === statusTarget.id ? res.data : booking))
      setStatusTarget(null)
      toast.success('Статус бронирования обновлён')
    } catch {
      toast.error('Не удалось обновить статус')
    } finally {
      setStatusSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return

    setDeleting(true)
    try {
      const res = await fetch(`/api/bookings/${deleteTarget.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        toast.error(json?.error?.message ?? 'Не удалось удалить бронирование')
        return
      }

      setBookings((prev) => prev.filter((booking) => booking.id !== deleteTarget.id))
      setDeleteTarget(null)
      toast.success('Бронирование удалено')
    } catch {
      toast.error('Не удалось удалить бронирование')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="space-y-6">
        <FilterBar>
          <div className="flex flex-1 flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <FilterChip label="Все" active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} />
              {(['confirmed', 'seated', 'cancelled', 'no_show'] as BookingStatus[]).map((status) => (
                <FilterChip
                  key={status}
                  label={BOOKING_STATUS_LABELS[status]}
                  active={statusFilter === status}
                  onClick={() => setStatusFilter(status)}
                />
              ))}
            </div>
            <DateRangePicker from={from} to={to} onChange={(nextFrom, nextTo) => { setFrom(nextFrom); setTo(nextTo) }} />
          </div>
          <Button onClick={() => setCreateOpen(true)}>Новое бронирование</Button>
        </FilterBar>

        {loading || session.loading ? (
          <SkeletonCard className="h-[440px]" />
        ) : error ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>
        ) : (
          <DataTable<BookingRow>
            columns={columns}
            data={visibleRows}
            keyField="id"
            emptyText="В выбранном диапазоне бронирований не найдено"
            pageSize={12}
          />
        )}
      </div>

      {createOpen && (
        <DialogShell title="Новое бронирование" onClose={() => setCreateOpen(false)}>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              label="Имя гостя"
              required
              value={form.guest_name}
              onChange={(value) => setForm((prev) => ({ ...prev, guest_name: value }))}
            />
            <FormField
              label="Телефон"
              type="tel"
              value={form.guest_phone}
              onChange={(value) => setForm((prev) => ({ ...prev, guest_phone: value }))}
            />
            <FormField
              as="select"
              label="Стол"
              required
              value={form.table_id}
              onChange={(value) => setForm((prev) => ({ ...prev, table_id: value }))}
            >
              {tables.map((table) => (
                <option key={table.id} value={table.id}>
                  {table.name} · {table.capacity} мест
                </option>
              ))}
            </FormField>
            <FormField
              label="Гостей"
              type="number"
              required
              value={form.party_size}
              onChange={(value) => setForm((prev) => ({ ...prev, party_size: value }))}
            />
            <FormField
              label="Дата"
              type="date"
              required
              value={form.date}
              onChange={(value) => setForm((prev) => ({ ...prev, date: value }))}
            />
            <FormField
              label="Время"
              type="time"
              required
              value={form.time}
              onChange={(value) => setForm((prev) => ({ ...prev, time: value }))}
            />
            <FormField
              as="textarea"
              label="Заметки"
              className="md:col-span-2"
              value={form.notes}
              onChange={(value) => setForm((prev) => ({ ...prev, notes: value }))}
            />
          </div>

          <div className="mt-6 flex justify-end">
            <Button loading={saving} onClick={handleCreate}>
              Создать бронирование
            </Button>
          </div>
        </DialogShell>
      )}

      {statusTarget && (
        <DialogShell title="Изменить статус бронирования" onClose={() => setStatusTarget(null)}>
          <div className="space-y-4">
            <FormField
              as="select"
              label="Статус"
              value={nextStatus}
              onChange={(value) => setNextStatus(value as BookingStatus)}
            >
              {(['confirmed', 'seated', 'cancelled', 'no_show'] as BookingStatus[]).map((status) => (
                <option key={status} value={status}>
                  {BOOKING_STATUS_LABELS[status]}
                </option>
              ))}
            </FormField>
            <div className="flex justify-end">
              <Button loading={statusSaving} onClick={handleStatusUpdate}>
                Сохранить статус
              </Button>
            </div>
          </div>
        </DialogShell>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Удалить бронирование?"
        description={
          deleteTarget
            ? `Бронирование для ${deleteTarget.guest_name} будет удалено без возможности восстановления.`
            : undefined
        }
        confirmLabel="Удалить"
        loading={deleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </>
  )
}

function DialogShell({
  title,
  children,
  onClose,
}: {
  title: string
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Закрыть форму"
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
      />
      <div className="relative z-10 w-full max-w-2xl rounded-3xl border border-surface-border bg-white p-6 shadow-card-md">
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="text-xl font-bold text-ink">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>Закрыть</Button>
        </div>
        {children}
      </div>
    </div>
  )
}

function todayInTashkent() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tashkent' })
}

function toIso(date: string, time: string) {
  return new Date(`${date}T${time}:00+05:00`).toISOString()
}

function toDateInput(value: string) {
  return new Date(value).toLocaleDateString('sv-SE', { timeZone: 'Asia/Tashkent' })
}
