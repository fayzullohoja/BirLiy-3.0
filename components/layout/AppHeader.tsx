'use client'

import { cn } from '@/lib/utils'

interface AppHeaderProps {
  title: string
  subtitle?: string
  leftSlot?: React.ReactNode
  rightSlot?: React.ReactNode
  className?: string
  /** When true, renders a flat header without bottom border — useful over white content */
  flat?: boolean
}

/**
 * Fixed top header bar.
 * Height matches the --header-height CSS variable (56px).
 * Left/right slots accept icon buttons or custom nodes.
 */
export default function AppHeader({
  title,
  subtitle,
  leftSlot,
  rightSlot,
  className,
  flat = false,
}: AppHeaderProps) {
  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-40',
        'flex items-center h-14 px-4 gap-3',
        'bg-surface pt-safe',
        !flat && 'border-b border-surface-border shadow-sm',
        className,
      )}
    >
      {/* Left slot */}
      <div className="w-10 flex items-center justify-start shrink-0">
        {leftSlot}
      </div>

      {/* Title */}
      <div className="flex-1 min-w-0 text-center">
        <h1 className="text-base font-bold text-ink leading-tight truncate">{title}</h1>
        {subtitle && (
          <p className="text-xs text-ink-secondary leading-tight truncate">{subtitle}</p>
        )}
      </div>

      {/* Right slot */}
      <div className="w-10 flex items-center justify-end shrink-0">
        {rightSlot}
      </div>
    </header>
  )
}

// ─── Icon Button helper ───────────────────────────────────────────────────────

interface HeaderIconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
  label: string
}

export function HeaderIconButton({ children, label, className, ...props }: HeaderIconButtonProps) {
  return (
    <button
      aria-label={label}
      className={cn(
        'w-9 h-9 flex items-center justify-center',
        'rounded-xl text-ink-secondary',
        'hover:bg-surface-muted active:bg-surface-border',
        'transition-colors duration-150',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
