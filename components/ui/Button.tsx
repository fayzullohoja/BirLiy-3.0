'use client'

import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
export type ButtonSize    = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  fullWidth?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:   'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 shadow-sm disabled:bg-brand-300',
  secondary: 'bg-brand-50 text-brand-700 hover:bg-brand-100 active:bg-brand-200 border border-brand-200',
  ghost:     'bg-transparent text-ink hover:bg-surface-muted active:bg-surface-border',
  outline:   'bg-transparent text-brand-600 border border-brand-500 hover:bg-brand-50 active:bg-brand-100',
  danger:    'bg-danger text-white hover:bg-red-600 active:bg-red-700 shadow-sm',
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5 rounded-xl',
  md: 'h-12 px-4 text-base gap-2 rounded-2xl',
  lg: 'h-14 px-6 text-lg gap-2.5 rounded-2xl',
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      fullWidth = false,
      leftIcon,
      rightIcon,
      children,
      className,
      disabled,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={cn(
          'inline-flex items-center justify-center font-semibold',
          'transition-colors duration-150 select-none',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'touch-target',
          variantStyles[variant],
          sizeStyles[size],
          fullWidth && 'w-full',
          className,
        )}
        {...props}
      >
        {loading ? (
          <Spinner size={size} />
        ) : (
          <>
            {leftIcon && <span className="shrink-0">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="shrink-0">{rightIcon}</span>}
          </>
        )}
      </button>
    )
  },
)

Button.displayName = 'Button'
export default Button

// ─── Spinner ─────────────────────────────────────────────────────────────────

function Spinner({ size }: { size: ButtonSize }) {
  const dim = size === 'sm' ? 14 : size === 'md' ? 18 : 22
  return (
    <svg
      width={dim}
      height={dim}
      viewBox="0 0 24 24"
      fill="none"
      className="animate-spin"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}
