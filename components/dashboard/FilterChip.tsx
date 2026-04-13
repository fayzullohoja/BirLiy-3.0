'use client'

import { cn } from '@/lib/utils'

interface FilterChipProps {
  label: string
  active: boolean
  onClick: () => void
  count?: number
}

export default function FilterChip({ label, active, onClick, count }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'border-brand-600 bg-brand-600 text-white'
          : 'border-surface-border bg-white text-ink-secondary hover:bg-surface-muted',
      )}
    >
      <span>{label}</span>
      {typeof count === 'number' && (
        <span
          className={cn(
            'inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold',
            active ? 'bg-white/20 text-white' : 'bg-surface-muted text-ink-muted',
          )}
        >
          {count}
        </span>
      )}
    </button>
  )
}
