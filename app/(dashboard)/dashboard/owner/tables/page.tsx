'use client'

import { useEffect, useMemo, useState } from 'react'
import { TableStatusBadge } from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import FormField from '@/components/ui/FormField'
import { toast } from '@/components/ui/Toast'
import ConfirmDialog from '@/components/dashboard/ConfirmDialog'
import FilterBar from '@/components/dashboard/FilterBar'
import FilterChip from '@/components/dashboard/FilterChip'
import SearchInput from '@/components/dashboard/SearchInput'
import { SkeletonCard } from '@/components/dashboard/Skeleton'
import { useDashboardSession } from '@/components/dashboard/DashboardSessionContext'
import type { Table, TableStatus } from '@/lib/types'
import { pluralRu } from '@/lib/utils'

const TABLE_STATUS_FILTERS: Array<{ label: string; value: 'all' | TableStatus }> = [
  { label: 'Все', value: 'all' },
  { label: 'Свободные', value: 'free' },
  { label: 'Занятые', value: 'occupied' },
  { label: 'Бронь', value: 'reserved' },
  { label: 'Счёт', value: 'bill_requested' },
]

const EMPTY_FORM = { name: '', number: '1', capacity: '4' }

export default function DashboardOwnerTablesPage() {
  const session = useDashboardSession()
  const [tables, setTables] = useState<Table[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | TableStatus>('all')
  const [search, setSearch] = useState('')

  const [editorOpen, setEditorOpen] = useState(false)
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create')
  const [editingTable, setEditingTable] = useState<Table | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<Table | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!session.selectedShopId) return

    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)

      try {
        const res = await fetch(`/api/tables?shop_id=${session.selectedShopId}`, {
          cache: 'no-store',
        }).then((response) => response.json())

        if (cancelled) return
        if (res.error) {
          setError(res.error.message)
          return
        }

        setTables((res.data ?? []).sort((left: Table, right: Table) => left.number - right.number))
      } catch {
        if (!cancelled) setError('Не удалось загрузить столы')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [session.selectedShopId])

  const visibleTables = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return tables.filter((table) => {
      if (statusFilter !== 'all' && table.status !== statusFilter) return false
      if (!needle) return true

      return table.name.toLowerCase().includes(needle) || String(table.number).includes(needle)
    })
  }, [search, statusFilter, tables])

  function openCreate() {
    setEditorMode('create')
    setEditingTable(null)
    setForm(EMPTY_FORM)
    setEditorOpen(true)
  }

  function openEdit(table: Table) {
    setEditorMode('edit')
    setEditingTable(table)
    setForm({
      name: table.name,
      number: String(table.number),
      capacity: String(table.capacity),
    })
    setEditorOpen(true)
  }

  async function handleSave() {
    if (!session.selectedShopId) return
    if (!form.name.trim()) {
      toast.error('Введите название стола')
      return
    }

    const number = Number.parseInt(form.number, 10)
    const capacity = Number.parseInt(form.capacity, 10)

    if (!Number.isInteger(number) || number < 1) {
      toast.error('Введите корректный номер стола')
      return
    }
    if (!Number.isInteger(capacity) || capacity < 1) {
      toast.error('Введите корректную вместимость')
      return
    }

    setSaving(true)
    try {
      const url = editorMode === 'create'
        ? '/api/tables'
        : `/api/tables/${editingTable?.id}`

      const res = await fetch(url, {
        method: editorMode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop_id: session.selectedShopId,
          name: form.name.trim(),
          number,
          capacity,
        }),
      }).then((response) => response.json())

      if (res.error) {
        toast.error(res.error.message)
        return
      }

      const updatedTable = res.data as Table
      setTables((prev) => {
        const next = editorMode === 'create'
          ? [...prev, updatedTable]
          : prev.map((table) => table.id === updatedTable.id ? updatedTable : table)
        return next.sort((left, right) => left.number - right.number)
      })
      setEditorOpen(false)
      toast.success(editorMode === 'create' ? 'Стол добавлен' : 'Стол обновлён')
    } catch {
      toast.error('Не удалось сохранить стол')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return

    setDeleting(true)
    try {
      const res = await fetch(`/api/tables/${deleteTarget.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        toast.error(json?.error?.message ?? 'Не удалось удалить стол')
        return
      }

      setTables((prev) => prev.filter((table) => table.id !== deleteTarget.id))
      setDeleteTarget(null)
      toast.success('Стол удалён')
    } catch {
      toast.error('Не удалось удалить стол')
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
              {TABLE_STATUS_FILTERS.map((filter) => (
                <FilterChip
                  key={filter.value}
                  label={filter.label}
                  active={statusFilter === filter.value}
                  onClick={() => setStatusFilter(filter.value)}
                />
              ))}
            </div>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Поиск по названию или номеру стола"
              className="w-full max-w-md"
            />
          </div>
          <Button onClick={openCreate}>Добавить стол</Button>
        </FilterBar>

        {loading || session.loading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <SkeletonCard key={index} className="h-[188px]" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>
        ) : visibleTables.length === 0 ? (
          <div className="rounded-3xl border border-surface-border bg-white p-10 text-center shadow-sm">
            <p className="text-lg font-bold text-ink">Подходящих столов нет</p>
            <p className="mt-2 text-sm text-ink-secondary">Измените фильтр или добавьте новый стол в текущем заведении.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibleTables.map((table) => (
              <article
                key={table.id}
                className="rounded-3xl border border-surface-border bg-white p-5 shadow-sm transition-shadow hover:shadow-card"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Стол №{table.number}</p>
                    <h2 className="mt-2 text-xl font-bold text-ink">{table.name}</h2>
                    <p className="mt-1 text-sm text-ink-secondary">{pluralRu(table.capacity, 'место', 'места', 'мест')}</p>
                  </div>
                  <TableStatusBadge status={table.status} />
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-surface-border pt-4">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(table)}>
                    Изменить
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={table.status !== 'free'}
                    onClick={() => setDeleteTarget(table)}
                  >
                    Удалить
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {editorOpen && (
        <DialogShell
          title={editorMode === 'create' ? 'Добавить стол' : 'Изменить стол'}
          onClose={() => setEditorOpen(false)}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              label="Название"
              required
              value={form.name}
              onChange={(value) => setForm((prev) => ({ ...prev, name: value }))}
              className="md:col-span-2"
            />
            <FormField
              label="Номер"
              type="number"
              required
              value={form.number}
              onChange={(value) => setForm((prev) => ({ ...prev, number: value }))}
            />
            <FormField
              label="Вместимость"
              type="number"
              required
              value={form.capacity}
              onChange={(value) => setForm((prev) => ({ ...prev, capacity: value }))}
            />
          </div>

          <div className="mt-6 flex justify-end">
            <Button loading={saving} onClick={handleSave}>
              {editorMode === 'create' ? 'Создать стол' : 'Сохранить'}
            </Button>
          </div>
        </DialogShell>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Удалить стол?"
        description={
          deleteTarget
            ? `Стол "${deleteTarget.name}" будет удалён без возможности восстановления. Удаление доступно только для свободных столов.`
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
        className="absolute inset-0 bg-black/50"
        aria-label="Закрыть форму"
        onClick={onClose}
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
