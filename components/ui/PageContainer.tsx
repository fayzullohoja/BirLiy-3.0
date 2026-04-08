import { cn } from '@/lib/utils'

interface PageContainerProps {
  children: React.ReactNode
  className?: string
  /** If true, adds the standard top/bottom padding to account for header + nav */
  inset?: boolean
}

/**
 * Top-level page wrapper. Handles safe-area padding and scroll behavior.
 * Use as the outermost element inside every page.
 */
export default function PageContainer({ children, className, inset = true }: PageContainerProps) {
  return (
    <main
      className={cn(
        'flex flex-col flex-1',
        inset && 'page-content',
        'overflow-y-auto overscroll-none',
        className,
      )}
    >
      {children}
    </main>
  )
}

// ─── Section wrapper with horizontal padding ─────────────────────────────────

interface SectionProps {
  children: React.ReactNode
  className?: string
  title?: string
  action?: React.ReactNode
}

export function Section({ children, className, title, action }: SectionProps) {
  return (
    <section className={cn('px-4', className)}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-3">
          {title && <h2 className="section-label">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

// ─── Empty state ─────────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-6 text-center', className)}>
      {icon && (
        <div className="w-16 h-16 rounded-full bg-brand-50 flex items-center justify-center mb-4 text-brand-500">
          {icon}
        </div>
      )}
      <p className="text-base font-semibold text-ink">{title}</p>
      {description && <p className="text-sm text-ink-secondary mt-1 max-w-xs">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
