'use client'

import { useCallback, useEffect, useState } from 'react'
import AppHeader from '@/components/layout/AppHeader'
import PageContainer, { Section, EmptyState } from '@/components/ui/PageContainer'
import Badge, { type BadgeVariant } from '@/components/ui/Badge'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { formatTime, formatDate } from '@/lib/utils'
import { useOwnerSession } from '../_context/OwnerSessionContext'
import type { Table, TableBooking, BookingStatus } from '@/lib/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<BookingStatus, string> = {
  confirmed: 'Подтверждено',
  seated:    'Размещены',
  cancelled: 'Отменено',
  no_show:   'Не явились',
}

const STATUS_VARIANT: Record<BookingStatus, BadgeVariant> = {
  confirmed: 'info',
  seated:    'success',
  cancelled: 'danger',
  no_show:   'neutral',
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface BookingForm {
  table_id:         string
  guest_name:       string
  guest_phone:      string
  party_size:       string
  booked_at_date:   string   // YYYY-MM-DD (local Tashkent)
  booked_at_time:   string   // HH:mm
  duration_minutes: string
  notes:            string
}

function todayStr() {
  const d = new Date()
  return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tashkent' })
}

function nowTimeStr() {
  const d = new Date()
  return d.toLocaleTimeString('sv-SE', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit' })
}

const EMPTY_FORM = (): BookingForm => ({
  table_id: '', guest_name: '', guest_phone: '', party_size: '2',
  booked_at_date: todayStr(), booked_at_time: nowTimeStr(),
  duration_minutes: '90', notes: '',
})

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OwnerBookingsPage() {
  const session = useOwnerSession()

  const [bookings, setBookings]   = useState<TableBooking[]>([])
  const [tables, setTables]       = useState<Table[]>([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const [dateFilter, setDateFilter] = useState(todayStr())
  const [sheetOpen, setSheetOpen]   = useState(false)
  const [form, setForm]             = useState<BookingForm>(EMPTY_FORM())
  const [statusSheet, setStatusSheet] = useState<TableBooking | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TableBooking | null>(null)

  // ── Fetch ───────────────────────────────────────────────────────────────────
  const fetchData = useCallback(() => {
    if (session.loading) return
    setLoading(true)
    Promise.all([
      fetch(`/api/bookings?shop_id=${session.primaryShopId}&date=${dateFilter}`).then(r => r.json()),
      fetch(`/api/tables?shop_id=${session.primaryShopId}`).then(r => r.json()),
    ])
      .then(([bookRes, tableRes]) => {
        if (bookRes.error) { setError(bookRes.error.message); return }
        setBookings(bookRes.data ?? [])
        setTables(tableRes.data ?? [])
      })
      .catch(() => setError('Не удалось загрузить бронирования'))
      .finally(() => setLoading(false))
  }, [session.loading, session.primaryShopId, dateFilter])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Open create sheet ───────────────────────────────────────────────────────
  function openCreate() {
    setForm(EMPTY_FORM())
    setFormError(null)
    setSheetOpen(true)
  }

  function field<K extends keyof BookingForm>(key: K, val: string) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  // ── Save ─────────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!form.table_id)        { setFormError('Выберите стол'); return }
    if (!form.guest_name.trim()) { setFormError('Введите имя гостя'); return }
    if (!form.booked_at_date)  { setFormError('Укажите дату'); return }
    if (!form.booked_at_time)  { setFormError('Укажите время'); return }
    const partySize = parseInt(form.party_size, 10)
    if (!partySize || partySize < 1) { setFormError('Укажите количество гостей'); return }

    // Compose ISO timestamp in Tashkent timezone
    const bookedAt = new Date(`${form.booked_at_date}T${form.booked_at_time}:00+05:00`).toISOString()

    setSaving(true); setFormError(null)
    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shop_id:          session.primaryShopId,
        table_id:         form.table_id,
        guest_name:       form.guest_name.trim(),
        guest_phone:      form.guest_phone.trim() || null,
        party_size:       partySize,
        booked_at:        bookedAt,
        duration_minutes: parseInt(form.duration_minutes, 10) || 90,
        notes:            form.notes.trim() || null,
      }),
    }).then(r => r.json()).finally(() => setSaving(false))

    if (res.error) { setFormError(res.error.message); return }
    setSheetOpen(false)
    fetchData()
  }

  // ── Update status ─────────────────────────────────────────────────────────────
  async function updateStatus(booking: TableBooking, status: BookingStatus) {
    setSaving(true)
    await fetch(`/api/bookings/${booking.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }).finally(() => setSaving(false))
    setStatusSheet(null)
    fetchData()
  }

  // ── Delete ────────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteTarget) return
    setSaving(true)
    await fetch(`/api/bookings/${deleteTarget.id}`, { method: 'DELETE' }).finally(() => setSaving(false))
    setDeleteTarget(null)
    fetchData()
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const active   = bookings.filter(b => b.status === 'confirmed' || b.status === 'seated')
  const past     = bookings.filter(b => b.status === 'cancelled' || b.status === 'no_show')

  return (
    <>
      <AppHeader
        title="Бронирования"
        subtitle={loading ? '' : `${active.length} активных`}
        rightSlot={
          <button onClick={openCreate} className="w-9 h-9 flex items-center justify-center rounded-xl bg-brand-600 text-white" aria-label="Добавить бронь">
            <PlusIcon />
          </button>
        }
      />

      <PageContainer>
        {/* Date picker */}
        <div className="px-4 pt-4 pb-3">
          <input
            type="date"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-surface border border-surface-border text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <Section className="pb-2">
          {loading || session.loading ? (
            <BookingsSkeleton />
          ) : error ? (
            <EmptyState title="Ошибка" description={error} />
          ) : bookings.length === 0 ? (
            <EmptyState
              title="Бронирований нет"
              description={`На ${formatDate(dateFilter + 'T00:00:00Z')} бронирований нет`}
              action={<button onClick={openCreate} className="px-5 py-2.5 rounded-2xl bg-brand-600 text-white text-sm font-semibold">Добавить бронь</button>}
            />
          ) : (
            <>
              {active.length > 0 && (
                <div className="mb-4 space-y-2">
                  <p className="section-label mb-2">Активные</p>
                  {active.map(b => (
                    <BookingCard
                      key={b.id}
                      booking={b}
                      onStatus={() => setStatusSheet(b)}
                      onDelete={() => setDeleteTarget(b)}
                    />
                  ))}
                </div>
              )}
              {past.length > 0 && (
                <div className="space-y-2">
                  <p className="section-label mb-2">Завершённые</p>
                  {past.map(b => (
                    <BookingCard
                      key={b.id}
                      booking={b}
                      onStatus={() => setStatusSheet(b)}
                      onDelete={() => setDeleteTarget(b)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </Section>
        <div className="h-6" />
      </PageContainer>

      {/* Create sheet */}
      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Новое бронирование">
        <div className="px-4 py-4 flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-1">Стол</label>
            <select value={form.table_id} onChange={e => field('table_id', e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-surface-muted border border-surface-border text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-500">
              <option value="">— Выберите стол —</option>
              {tables.map(t => <option key={t.id} value={t.id}>{t.name} (№{t.number}, {t.capacity} мест)</option>)}
            </select>
          </div>
          <Field label="Имя гостя"  placeholder="Алишер" value={form.guest_name}  onChange={v => field('guest_name', v)} />
          <Field label="Телефон"    placeholder="+998 90 123 45 67" value={form.guest_phone} onChange={v => field('guest_phone', v)} />
          <Field label="Кол-во гостей" placeholder="2" type="number" value={form.party_size} onChange={v => field('party_size', v)} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Дата" type="date" value={form.booked_at_date} onChange={v => field('booked_at_date', v)} />
            <Field label="Время" type="time" value={form.booked_at_time} onChange={v => field('booked_at_time', v)} />
          </div>
          <Field label="Длительность (мин)" placeholder="90" type="number" value={form.duration_minutes} onChange={v => field('duration_minutes', v)} />
          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-1">Примечание</label>
            <textarea value={form.notes} onChange={e => field('notes', e.target.value)} placeholder="VIP стол, аллергия на орехи..." rows={2} className="w-full px-3 py-2.5 rounded-xl bg-surface-muted border border-surface-border text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
          </div>
          {formError && <p className="text-sm text-danger">{formError}</p>}
          <button onClick={handleSave} disabled={saving} className="w-full py-3.5 rounded-2xl bg-brand-600 text-white font-semibold text-sm disabled:opacity-50">
            {saving ? 'Создаём...' : 'Создать бронирование'}
          </button>
        </div>
      </BottomSheet>

      {/* Status sheet */}
      <BottomSheet open={!!statusSheet} onClose={() => setStatusSheet(null)} title="Изменить статус">
        <div className="px-4 py-4 flex flex-col gap-2">
          {statusSheet && (['confirmed', 'seated', 'cancelled', 'no_show'] as BookingStatus[]).map(s => (
            <button
              key={s}
              disabled={statusSheet.status === s || saving}
              onClick={() => updateStatus(statusSheet, s)}
              className={`w-full py-3 rounded-2xl text-sm font-semibold transition-colors ${
                statusSheet.status === s
                  ? 'bg-surface-muted text-ink-muted border border-surface-border cursor-default'
                  : 'bg-surface border border-surface-border text-ink active:bg-surface-muted'
              }`}
            >
              {STATUS_LABELS[s]}
              {statusSheet.status === s && ' ✓'}
            </button>
          ))}
        </div>
      </BottomSheet>

      {/* Delete confirm */}
      <BottomSheet open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Удалить бронирование?">
        <div className="px-4 py-4 flex flex-col gap-3">
          <p className="text-sm text-ink-secondary">
            Удалить бронь <strong>{deleteTarget?.guest_name}</strong> на {deleteTarget && formatTime(deleteTarget.booked_at)}?
          </p>
          <button onClick={handleDelete} disabled={saving} className="w-full py-3.5 rounded-2xl bg-danger text-white font-semibold text-sm disabled:opacity-50">
            {saving ? 'Удаляем...' : 'Удалить'}
          </button>
          <button onClick={() => setDeleteTarget(null)} className="w-full py-3 text-ink-secondary text-sm font-medium">Отмена</button>
        </div>
      </BottomSheet>
    </>
  )
}

// ─── Booking card ─────────────────────────────────────────────────────────────

function BookingCard({ booking, onStatus, onDelete }: {
  booking: TableBooking; onStatus: () => void; onDelete: () => void
}) {
  const table = booking.table as unknown as { name: string; number: number } | undefined

  return (
    <div className="bg-surface rounded-2xl border border-surface-border p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-ink">{booking.guest_name}</p>
            <Badge variant={STATUS_VARIANT[booking.status]}>{STATUS_LABELS[booking.status]}</Badge>
          </div>
          <p className="text-xs text-ink-secondary mt-0.5">
            {table ? `${table.name}` : 'Стол не указан'} · {booking.party_size} чел.
          </p>
          <p className="text-xs text-ink-muted">
            {formatTime(booking.booked_at)} · {booking.duration_minutes} мин
          </p>
          {booking.guest_phone && <p className="text-xs text-ink-muted">{booking.guest_phone}</p>}
          {booking.notes && <p className="text-xs text-ink-muted italic mt-1">{booking.notes}</p>}
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          <button onClick={onStatus} className="text-xs font-medium text-brand-600 py-1 px-2 rounded-lg bg-brand-50">Статус</button>
          <button onClick={onDelete} className="text-xs font-medium text-danger py-1 px-2 rounded-lg bg-red-50">Удалить</button>
        </div>
      </div>
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-ink-secondary mb-1">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full px-3 py-2.5 rounded-xl bg-surface-muted border border-surface-border text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-500" />
    </div>
  )
}

function BookingsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-24 rounded-2xl bg-surface animate-pulse border border-surface-border" />
      ))}
    </div>
  )
}

function PlusIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
}
