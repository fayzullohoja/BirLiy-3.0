import { cn } from '@/lib/utils'

export type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'

interface BadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
  className?: string
  dot?: boolean
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-brand-100 text-brand-700',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-amber-100 text-amber-700',
  danger:  'bg-red-100 text-red-700',
  info:    'bg-blue-100 text-blue-700',
  neutral: 'bg-surface-muted text-ink-secondary border border-surface-border',
}

const dotStyles: Record<BadgeVariant, string> = {
  default: 'bg-brand-500',
  success: 'bg-green-500',
  warning: 'bg-amber-500',
  danger:  'bg-red-500',
  info:    'bg-blue-500',
  neutral: 'bg-ink-muted',
}

export default function Badge({ variant = 'default', children, className, dot }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5',
        'text-xs font-semibold rounded-full whitespace-nowrap',
        variantStyles[variant],
        className,
      )}
    >
      {dot && (
        <span
          className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotStyles[variant])}
          aria-hidden
        />
      )}
      {children}
    </span>
  )
}

// ─── Table Status Badge ───────────────────────────────────────────────────────

import type { TableStatus, OrderStatus } from '@/lib/types'
import { TABLE_STATUS_LABELS, ORDER_STATUS_LABELS } from '@/lib/utils'

const TABLE_STATUS_VARIANT: Record<TableStatus, BadgeVariant> = {
  free:           'success',
  occupied:       'warning',
  reserved:       'info',
  bill_requested: 'danger',
}

const ORDER_STATUS_VARIANT: Record<OrderStatus, BadgeVariant> = {
  open:       'neutral',
  in_kitchen: 'warning',
  ready:      'success',
  paid:       'info',
  cancelled:  'danger',
}

export function TableStatusBadge({ status }: { status: TableStatus }) {
  return (
    <Badge variant={TABLE_STATUS_VARIANT[status]} dot>
      {TABLE_STATUS_LABELS[status]}
    </Badge>
  )
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge variant={ORDER_STATUS_VARIANT[status]} dot>
      {ORDER_STATUS_LABELS[status]}
    </Badge>
  )
}
