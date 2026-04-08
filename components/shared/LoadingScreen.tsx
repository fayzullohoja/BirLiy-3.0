import { cn } from '@/lib/utils'

interface LoadingScreenProps {
  message?: string
  className?: string
}

export default function LoadingScreen({ message = 'Загрузка...', className }: LoadingScreenProps) {
  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex flex-col items-center justify-center',
        'bg-surface gap-4',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <BrandSpinner />
      <p className="text-sm font-medium text-ink-secondary">{message}</p>
    </div>
  )
}

function BrandSpinner() {
  return (
    <div className="relative w-12 h-12">
      {/* Outer ring */}
      <svg
        className="absolute inset-0 animate-spin"
        viewBox="0 0 48 48"
        fill="none"
      >
        <circle cx="24" cy="24" r="20" stroke="#e4ebe7" strokeWidth="4" />
        <path
          d="M24 4a20 20 0 0 1 20 20"
          stroke="#1a8458"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>
      {/* Center brand dot */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-3 h-3 rounded-full bg-brand-600" />
      </div>
    </div>
  )
}

// ─── Inline Spinner (use inside content areas) ────────────────────────────────

interface InlineSpinnerProps {
  size?: number
  className?: string
}

export function InlineSpinner({ size = 20, className }: InlineSpinnerProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={cn('animate-spin text-brand-600', className)}
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.2" />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

// ─── Skeleton block ───────────────────────────────────────────────────────────

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn('animate-pulse rounded-xl bg-surface-muted', className)}
      aria-hidden
    />
  )
}

export function SkeletonCard() {
  return (
    <div className="card p-4 space-y-3">
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-3 w-1/2" />
      <Skeleton className="h-8 w-full mt-2" />
    </div>
  )
}
