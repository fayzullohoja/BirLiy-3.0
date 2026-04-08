import { cn } from '@/lib/utils'

// ─── Base Card ────────────────────────────────────────────────────────────────

interface CardProps {
  children: React.ReactNode
  className?: string
  onClick?: () => void
  padding?: 'sm' | 'md' | 'lg' | 'none'
}

const paddingStyles = {
  none: '',
  sm:   'p-3',
  md:   'p-4',
  lg:   'p-5',
}

export default function Card({ children, className, onClick, padding = 'md' }: CardProps) {
  const isClickable = typeof onClick === 'function'

  return (
    <div
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={isClickable ? (e) => e.key === 'Enter' && onClick() : undefined}
      className={cn(
        'card',
        paddingStyles[padding],
        isClickable && [
          'cursor-pointer select-none',
          'transition-all duration-150',
          'hover:shadow-card-md active:scale-[0.985] active:shadow-card',
        ],
        className,
      )}
    >
      {children}
    </div>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string
  value: string
  sub?: string
  icon?: React.ReactNode
  variant?: 'default' | 'brand'
}

export function StatCard({ label, value, sub, icon, variant = 'default' }: StatCardProps) {
  return (
    <Card
      className={cn(
        variant === 'brand' && 'bg-brand-600 border-brand-500 text-white',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className={cn(
            'section-label mb-1',
            variant === 'brand' ? 'text-brand-100' : '',
          )}>
            {label}
          </p>
          <p className={cn(
            'text-2xl font-bold leading-tight tracking-tight',
            variant === 'brand' ? 'text-white' : 'text-ink',
          )}>
            {value}
          </p>
          {sub && (
            <p className={cn(
              'text-sm mt-0.5',
              variant === 'brand' ? 'text-brand-200' : 'text-ink-secondary',
            )}>
              {sub}
            </p>
          )}
        </div>
        {icon && (
          <div className={cn(
            'shrink-0 w-10 h-10 rounded-xl flex items-center justify-center',
            variant === 'brand' ? 'bg-brand-500' : 'bg-brand-50',
          )}>
            <span className={variant === 'brand' ? 'text-white' : 'text-brand-600'}>
              {icon}
            </span>
          </div>
        )}
      </div>
    </Card>
  )
}

// ─── List Item Row ────────────────────────────────────────────────────────────

interface ListItemProps {
  leading?: React.ReactNode
  title: string
  subtitle?: string
  trailing?: React.ReactNode
  onClick?: () => void
  className?: string
}

export function ListItem({ leading, title, subtitle, trailing, onClick, className }: ListItemProps) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      className={cn(
        'flex items-center gap-3 px-4 py-3',
        onClick && 'cursor-pointer hover:bg-surface-muted active:bg-surface-border transition-colors',
        className,
      )}
    >
      {leading && <div className="shrink-0">{leading}</div>}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-ink leading-tight truncate">{title}</p>
        {subtitle && <p className="text-xs text-ink-secondary mt-0.5 truncate">{subtitle}</p>}
      </div>
      {trailing && <div className="shrink-0">{trailing}</div>}
    </div>
  )
}

// ─── Card Section ────────────────────────────────────────────────────────────

interface CardSectionProps {
  title?: string
  children: React.ReactNode
  className?: string
  action?: React.ReactNode
}

export function CardSection({ title, children, className, action }: CardSectionProps) {
  return (
    <div className={cn('card overflow-hidden', className)}>
      {title && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
          <span className="section-label">{title}</span>
          {action}
        </div>
      )}
      {children}
    </div>
  )
}
