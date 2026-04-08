'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { BottomSheet } from '@/components/ui/BottomSheet'
import Button from '@/components/ui/Button'
import { signOutCurrentSession } from '@/lib/auth/clientAuth'

interface AppHeaderProps {
  title: string
  subtitle?: string
  leftSlot?: React.ReactNode
  rightSlot?: React.ReactNode
  className?: string
  /** When true, renders a flat header without bottom border — useful over white content */
  flat?: boolean
  /** When true, shows a session logout action in the header */
  showSignOut?: boolean
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
  showSignOut = true,
}: AppHeaderProps) {
  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-40',
        'bg-surface pt-safe px-4',
        !flat && 'border-b border-surface-border shadow-sm',
        className,
      )}
    >
      <div className="relative flex items-center h-14 gap-3">
        {/* Left slot */}
        <div className="relative z-10 w-10 flex items-center justify-start shrink-0">
          {leftSlot}
        </div>

        {/* Title */}
        <div className="pointer-events-none absolute inset-y-0 inset-x-28 flex flex-col items-center justify-center text-center">
          <h1 className="text-base font-bold text-ink leading-tight truncate w-full">{title}</h1>
          {subtitle && (
            <p className="text-xs text-ink-secondary leading-tight truncate w-full">{subtitle}</p>
          )}
        </div>

        {/* Right actions */}
        <div className="relative z-10 ml-auto min-w-10 flex items-center justify-end gap-2 shrink-0">
          {rightSlot}
          {showSignOut && <HeaderSignOutButton />}
        </div>
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

function HeaderSignOutButton() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSignOut() {
    setLoading(true)
    try {
      await signOutCurrentSession()
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <HeaderIconButton label="Выйти" onClick={() => setOpen(true)}>
        <SignOutIcon />
      </HeaderIconButton>

      <BottomSheet
        open={open}
        onClose={() => {
          if (!loading) setOpen(false)
        }}
        title="Выйти из аккаунта?"
      >
        <div className="px-4 py-4 flex flex-col gap-3">
          <p className="text-sm text-ink-secondary">
            Текущая сессия будет завершена. В Telegram mini app закроется, а при следующем открытии вход выполнится заново.
          </p>
          <Button variant="danger" fullWidth loading={loading} onClick={handleSignOut}>
            Выйти
          </Button>
          <Button variant="secondary" fullWidth disabled={loading} onClick={() => setOpen(false)}>
            Отмена
          </Button>
        </div>
      </BottomSheet>
    </>
  )
}

function SignOutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  )
}
