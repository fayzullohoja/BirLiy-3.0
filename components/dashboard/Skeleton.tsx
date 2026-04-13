'use client'

import { cn } from '@/lib/utils'

export function SkeletonRow({ className }: { className?: string }) {
  return <div className={cn('h-12 w-full animate-pulse rounded-xl bg-surface-muted', className)} />
}

export function SkeletonCard({ className }: { className?: string }) {
  return <div className={cn('h-[120px] w-full animate-pulse rounded-2xl bg-surface-muted', className)} />
}

export function SkeletonText({ w = '100%', className }: { w?: string; className?: string }) {
  return (
    <div
      className={cn('h-4 animate-pulse rounded-xl bg-surface-muted', className)}
      style={{ width: w }}
    />
  )
}

export function SkeletonStat({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-2xl border border-surface-border bg-white p-5', className)}>
      <SkeletonText w="40%" className="mb-3 h-3" />
      <SkeletonText w="62%" className="mb-4 h-8 rounded-2xl" />
      <SkeletonText w="54%" className="h-3" />
    </div>
  )
}
