'use client'

import FilterChip from '@/components/dashboard/FilterChip'

interface DateRangePickerProps {
  from: string
  to: string
  onChange: (from: string, to: string) => void
}

type Preset = 'today' | '7d' | '30d' | '90d' | 'custom'

export default function DateRangePicker({ from, to, onChange }: DateRangePickerProps) {
  const activePreset = detectActivePreset(from, to)
  const customOpen = activePreset === 'custom'

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <FilterChip label="Сегодня" active={activePreset === 'today'} onClick={() => applyPreset('today', onChange)} />
        <FilterChip label="7 дней" active={activePreset === '7d'} onClick={() => applyPreset('7d', onChange)} />
        <FilterChip label="30 дней" active={activePreset === '30d'} onClick={() => applyPreset('30d', onChange)} />
        <FilterChip label="90 дней" active={activePreset === '90d'} onClick={() => applyPreset('90d', onChange)} />
        <FilterChip label="Период" active={customOpen} onClick={() => applyPreset('custom', onChange, { from, to })} />
      </div>

      {customOpen && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">От</span>
            <input
              type="date"
              value={from}
              onChange={(event) => onChange(normalizeRange(event.target.value, to).from, normalizeRange(event.target.value, to).to)}
              className="h-10 w-full rounded-xl border border-surface-border bg-surface-muted px-3 text-sm text-ink outline-none focus:border-brand-500"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">До</span>
            <input
              type="date"
              value={to}
              onChange={(event) => onChange(normalizeRange(from, event.target.value).from, normalizeRange(from, event.target.value).to)}
              className="h-10 w-full rounded-xl border border-surface-border bg-surface-muted px-3 text-sm text-ink outline-none focus:border-brand-500"
            />
          </label>
        </div>
      )}
    </div>
  )
}

function applyPreset(
  preset: Preset,
  onChange: (from: string, to: string) => void,
  current?: { from: string; to: string },
) {
  const today = tashkentDateInput()
  if (preset === 'today') {
    onChange(today, today)
    return
  }
  if (preset === '7d') {
    onChange(shiftTashkentDays(-6), today)
    return
  }
  if (preset === '30d') {
    onChange(shiftTashkentDays(-29), today)
    return
  }
  if (preset === '90d') {
    onChange(shiftTashkentDays(-89), today)
    return
  }
  onChange(current?.from ?? today, current?.to ?? today)
}

function detectActivePreset(from: string, to: string): Preset {
  const today = tashkentDateInput()
  if (from === today && to === today) return 'today'
  if (from === shiftTashkentDays(-6) && to === today) return '7d'
  if (from === shiftTashkentDays(-29) && to === today) return '30d'
  if (from === shiftTashkentDays(-89) && to === today) return '90d'
  return 'custom'
}

function normalizeRange(from: string, to: string) {
  if (!from || !to) return { from, to }
  return from <= to ? { from, to } : { from: to, to: from }
}

function tashkentDateInput(date = new Date()) {
  return date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tashkent' })
}

function shiftTashkentDays(days: number) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + days)
  return tashkentDateInput(date)
}
