'use client'

import { cn } from '@/lib/utils'

interface FilterBarProps {
  children: React.ReactNode
  className?: string
}

export default function FilterBar({ children, className }: FilterBarProps) {
  return (
    <div className={cn('rounded-2xl border border-surface-border bg-white p-4 shadow-sm', className)}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {children}
      </div>
    </div>
  )
}
