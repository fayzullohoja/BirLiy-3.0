'use client'

import { useMemo, useState } from 'react'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { SkeletonRow } from '@/components/dashboard/Skeleton'

export interface ColumnDef<T> {
  key: string
  header: string
  width?: string
  sortable?: boolean
  render: (row: T) => React.ReactNode
}

interface DataTableProps<T> {
  columns: ColumnDef<T>[]
  data: T[]
  keyField: keyof T
  loading?: boolean
  emptyText?: string
  onRowClick?: (row: T) => void
  pageSize?: number
}

type SortDirection = 'asc' | 'desc' | null

export default function DataTable<T extends object>({
  columns,
  data,
  keyField,
  loading = false,
  emptyText = 'Нет данных',
  onRowClick,
  pageSize = 25,
}: DataTableProps<T>) {
  const [page, setPage] = useState(1)
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)

  const sortedData = useMemo(() => {
    if (!sortKey || !sortDirection) return data

    return [...data].sort((a, b) => {
      const left = normalizeSortValue((a as Record<string, unknown>)[sortKey])
      const right = normalizeSortValue((b as Record<string, unknown>)[sortKey])

      if (left < right) return sortDirection === 'asc' ? -1 : 1
      if (left > right) return sortDirection === 'asc' ? 1 : -1
      return 0
    })
  }, [data, sortDirection, sortKey])

  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pageItems = sortedData.slice((safePage - 1) * pageSize, safePage * pageSize)

  function handleSort(column: ColumnDef<T>) {
    if (!column.sortable) return
    if (sortKey !== column.key) {
      setSortKey(column.key)
      setSortDirection('asc')
      setPage(1)
      return
    }
    if (sortDirection === 'asc') {
      setSortDirection('desc')
      setPage(1)
      return
    }
    if (sortDirection === 'desc') {
      setSortKey(null)
      setSortDirection(null)
      setPage(1)
      return
    }
    setSortDirection('asc')
    setPage(1)
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-surface-border bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead className="bg-surface-muted">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  style={column.width ? { width: column.width } : undefined}
                  className={cn(
                    'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted',
                    column.sortable && 'cursor-pointer select-none',
                  )}
                  onClick={() => handleSort(column)}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {column.header}
                    {column.sortable && <SortIndicator active={sortKey === column.key} direction={sortKey === column.key ? sortDirection : null} />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <tr key={`skeleton-${index}`} className="border-t border-surface-border bg-white">
                  <td colSpan={columns.length} className="px-4 py-3">
                    <SkeletonRow />
                  </td>
                </tr>
              ))
            ) : pageItems.length === 0 ? (
              <tr className="border-t border-surface-border bg-white">
                <td colSpan={columns.length} className="px-4 py-12 text-center text-sm text-ink-secondary">
                  {emptyText}
                </td>
              </tr>
            ) : (
              pageItems.map((row) => {
                const rowKey = row[keyField]
                return (
                  <tr
                    key={String(rowKey)}
                    className={cn(
                      'border-t border-surface-border bg-white text-sm text-ink',
                      onRowClick && 'cursor-pointer transition-colors hover:bg-surface-muted',
                    )}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    {columns.map((column) => (
                      <td key={column.key} className="px-4 py-3 align-middle">
                        {column.render(row)}
                      </td>
                    ))}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {!loading && totalPages > 1 && (
        <div className="flex flex-col gap-3 border-t border-surface-border bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink-secondary">
            Страница {safePage} из {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" disabled={safePage === 1} onClick={() => setPage(safePage - 1)}>
              Назад
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }).slice(0, 5).map((_, index) => {
                const pageNumber = index + 1
                return (
                  <button
                    key={pageNumber}
                    type="button"
                    onClick={() => setPage(pageNumber)}
                    className={cn(
                      'inline-flex h-9 w-9 items-center justify-center rounded-xl text-sm font-semibold transition-colors',
                      pageNumber === safePage
                        ? 'bg-brand-600 text-white'
                        : 'border border-surface-border text-ink-secondary hover:bg-surface-muted',
                    )}
                  >
                    {pageNumber}
                  </button>
                )
              })}
            </div>
            <Button size="sm" variant="secondary" disabled={safePage === totalPages} onClick={() => setPage(safePage + 1)}>
              Далее
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function SortIndicator({
  active,
  direction,
}: {
  active: boolean
  direction: SortDirection
}) {
  return (
    <span className={cn('text-[10px] leading-none text-ink-muted', active && 'text-brand-600')}>
      {direction === 'asc' ? '↑' : direction === 'desc' ? '↓' : '↕'}
    </span>
  )
}

function normalizeSortValue(value: unknown) {
  if (typeof value === 'number') return value
  if (typeof value === 'string') return value.toLowerCase()
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'boolean') return value ? 1 : 0
  return ''
}
