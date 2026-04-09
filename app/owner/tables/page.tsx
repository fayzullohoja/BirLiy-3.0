'use client'

import { useCallback, useEffect, useState } from 'react'
import AppHeader from '@/components/layout/AppHeader'
import PageContainer, { Section, EmptyState } from '@/components/ui/PageContainer'
import { TableStatusBadge } from '@/components/ui/Badge'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { toast } from '@/components/ui/Toast'
import { useOwnerSession } from '../_context/OwnerSessionContext'
import type { Table, TableStatus } from '@/lib/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type SheetMode = 'none' | 'create' | 'edit'

interface FormState {
  number:   string
  name:     string
  capacity: string
}

const EMPTY_FORM: FormState = { number: '', name: '', capacity: '4' }

const STATUS_ORDER: TableStatus[] = ['bill_requested', 'occupied', 'reserved', 'free']

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OwnerTablesPage() {
  const session = useOwnerSession()

  const [tables, setTables]       = useState<Table[]>([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const [sheetMode, setSheetMode] = useState<SheetMode>('none')
  const [editTarget, setEdit]     = useState<Table | null>(null)
  const [form, setForm]           = useState<FormState>(EMPTY_FORM)
  const [confirmDelete, setConfirmDelete] = useState<Table | null>(null)

  // ── Fetch ───────────────────────────────────────────────────────────────────
  const fetchTables = useCallback(() => {
    if (session.loading) return
    setLoading(true)
    fetch(`/api/tables?shop_id=${session.primaryShopId}`)
      .then(r => r.json())
      .then(res => {
        if (res.error) setError(res.error.message)
        else setTables(
          [...(res.data ?? [])].sort(
            (a: Table, b: Table) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status),
          ),
        )
      })
      .catch(() => setError('Не удалось загрузить столы'))
      .finally(() => setLoading(false))
  }, [session.loading, session.primaryShopId])

  useEffect(() => { fetchTables() }, [fetchTables])

  // ── Open sheets ─────────────────────────────────────────────────────────────
  function openCreate() {
    setForm(EMPTY_FORM)
    setFormError(null)
    setSheetMode('create')
  }

  function openEdit(t: Table) {
    setForm({ number: String(t.number), name: t.name, capacity: String(t.capacity) })
    setFormError(null)
    setEdit(t)
    setSheetMode('edit')
  }

  function closeSheet() {
    setSheetMode('none')
    setEdit(null)
    setFormError(null)
  }

  function field(key: keyof FormState, val: string) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  // ── Save ─────────────────────────────────────────────────────────────────────
  async function handleSave() {
    const num = parseInt(form.number, 10)
    const cap = parseInt(form.capacity, 10)
    if (!form.name.trim()) { setFormError('Введите название стола'); return }
    if (!num || num < 1)   { setFormError('Введите корректный номер'); return }
    if (!cap || cap < 1)   { setFormError('Вместимость должна быть ≥ 1'); return }

    setSaving(true)
    setFormError(null)

    const isEdit = sheetMode === 'edit' && editTarget

    const res = await fetch(
      isEdit ? `/api/tables/${editTarget.id}` : '/api/tables',
      {
        method:  isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          shop_id:  session.primaryShopId,
          number:   num,
          name:     form.name.trim(),
          capacity: cap,
        }),
      },
    ).then(r => r.json()).finally(() => setSaving(false))

    if (res.error) {
      setFormError(
        res.error.code === 'DUPLICATE_NUMBER'
          ? `Стол №${num} уже существует`
          : res.error.message,
      )
      return
    }

    closeSheet()
    fetchTables()
  }

  // ── Delete ───────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!confirmDelete) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/tables/${confirmDelete.id}`, { method: 'DELETE' })

      if (!res.ok) {
        const json = await res.json().catch(() => null)
        const message = json?.error?.message ?? 'Не удалось удалить стол'
        setError(message)
        toast.error(message)
        return
      }

      setConfirmDelete(null)
      toast.success('Стол удалён')
      fetchTables()
    } finally {
      setSaving(false)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <AppHeader
        title="Столы"
        subtitle={loading ? '' : `${tables.length} столов`}
        rightSlot={
          <button
            onClick={openCreate}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-brand-600 text-white"
            aria-label="Добавить стол"
          >
            <PlusIcon />
          </button>
        }
      />

      <PageContainer>
        <Section className="pt-4 pb-6">
          {loading || session.loading ? (
            <TablesSkeleton />
          ) : error ? (
            <EmptyState title="Ошибка" description={error} />
          ) : tables.length === 0 ? (
            <EmptyState
              title="Столов нет"
              description="Нажмите + чтобы добавить первый стол"
              action={
                <button onClick={openCreate} className="px-5 py-2.5 rounded-2xl bg-brand-600 text-white text-sm font-semibold">
                  Добавить стол
                </button>
              }
            />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {tables.map(t => (
                <TableCard
                  key={t.id}
                  table={t}
                  onEdit={() => openEdit(t)}
                  onDelete={() => setConfirmDelete(t)}
                />
              ))}
            </div>
          )}
        </Section>
      </PageContainer>

      {/* Create / Edit sheet */}
      <BottomSheet
        open={sheetMode !== 'none'}
        onClose={closeSheet}
        title={sheetMode === 'edit' ? 'Изменить стол' : 'Добавить стол'}
      >
        <div className="px-4 py-4 flex flex-col gap-4">
          <Field label="Название стола" placeholder="Стол 1 / VIP / Терраса" value={form.name}     onChange={v => field('name', v)} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Номер" placeholder="1" type="number" value={form.number}   onChange={v => field('number', v)} />
            <Field label="Мест"  placeholder="4" type="number" value={form.capacity} onChange={v => field('capacity', v)} />
          </div>
          {formError && <p className="text-sm text-danger">{formError}</p>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3.5 rounded-2xl bg-brand-600 text-white font-semibold text-sm disabled:opacity-50"
          >
            {saving ? 'Сохраняем...' : sheetMode === 'edit' ? 'Сохранить' : 'Создать стол'}
          </button>
        </div>
      </BottomSheet>

      {/* Delete confirmation sheet */}
      <BottomSheet
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Удалить стол?"
      >
        <div className="px-4 py-4 flex flex-col gap-3">
          <p className="text-sm text-ink-secondary">
            Вы уверены, что хотите удалить <strong>{confirmDelete?.name}</strong>?
            Это действие нельзя отменить.
          </p>
          <button
            onClick={handleDelete}
            disabled={saving}
            className="w-full py-3.5 rounded-2xl bg-danger text-white font-semibold text-sm disabled:opacity-50"
          >
            {saving ? 'Удаляем...' : 'Удалить'}
          </button>
          <button
            onClick={() => setConfirmDelete(null)}
            className="w-full py-3 rounded-2xl text-ink-secondary text-sm font-medium"
          >
            Отмена
          </button>
        </div>
      </BottomSheet>
    </>
  )
}

// ─── Table card ───────────────────────────────────────────────────────────────

function TableCard({ table, onEdit, onDelete }: {
  table: Table; onEdit: () => void; onDelete: () => void
}) {
  return (
    <div className="bg-surface rounded-2xl border border-surface-border p-3 flex flex-col gap-2">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-base font-bold text-ink leading-tight">{table.name}</p>
          <p className="text-xs text-ink-muted">№{table.number} · {table.capacity} мест</p>
        </div>
        <button onClick={onEdit} className="w-7 h-7 flex items-center justify-center rounded-lg bg-surface-muted text-ink-secondary" aria-label="Изменить">
          <PencilIcon />
        </button>
      </div>
      <TableStatusBadge status={table.status} />
      <button
        onClick={onDelete}
        className="text-xs text-danger font-medium text-left mt-0.5"
        disabled={table.status !== 'free'}
      >
        {table.status === 'free' ? 'Удалить' : '—'}
      </button>
    </div>
  )
}

// ─── Form field ───────────────────────────────────────────────────────────────

function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-ink-secondary mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-xl bg-surface-muted border border-surface-border text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-500"
      />
    </div>
  )
}

// ─── Skeleton / Icons ─────────────────────────────────────────────────────────

function TablesSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-28 rounded-2xl bg-surface animate-pulse" />
      ))}
    </div>
  )
}

function PlusIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
}
function PencilIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
}
