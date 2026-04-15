/**
 * Client-side CSV export utilities.
 * No dependencies — generates a plain CSV string and triggers a browser download.
 */

type CsvRow = Record<string, string | number | null | undefined>

/**
 * Convert an array of objects to a CSV string.
 * Headers are taken from the first row's keys (or from the explicit headers map).
 */
function toCsvString(rows: CsvRow[], headers: Record<string, string>): string {
  const keys = Object.keys(headers)
  const headerRow = keys.map(k => csvEscape(headers[k])).join(',')

  const dataRows = rows.map(row =>
    keys.map(k => csvEscape(String(row[k] ?? ''))).join(','),
  )

  return [headerRow, ...dataRows].join('\r\n')
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return '"' + value.replace(/"/g, '""') + '"'
  }
  return value
}

/**
 * Trigger a browser file download with the given CSV content.
 */
function downloadCsv(csvString: string, filename: string) {
  const bom = '\uFEFF' // UTF-8 BOM for Excel compatibility
  const blob = new Blob([bom + csvString], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

// ─── Domain-specific exports ──────────────────────────────────────────────────

import type { Order } from '@/lib/types'
import { formatUZS, formatDate, formatTime, PAYMENT_TYPE_LABELS, ORDER_STATUS_LABELS } from '@/lib/utils'

const ORDER_HEADERS: Record<string, string> = {
  id:           '№ заказа',
  date:         'Дата',
  time:         'Время',
  table:        'Стол',
  waiter:       'Официант',
  items_count:  'Позиций',
  total_amount: 'Сумма',
  payment_type: 'Оплата',
  status:       'Статус',
}

export function exportOrdersCsv(orders: Order[], filename = 'orders.csv') {
  const rows: CsvRow[] = orders.map(o => ({
    id:           o.id.slice(-6).toUpperCase(),
    date:         formatDate(o.created_at),
    time:         formatTime(o.created_at),
    table:        o.table?.name ?? '—',
    waiter:       o.waiter?.name ?? '—',
    items_count:  o.items?.length ?? 0,
    total_amount: formatUZS(o.total_amount),
    payment_type: o.payment_type ? PAYMENT_TYPE_LABELS[o.payment_type] : '—',
    status:       ORDER_STATUS_LABELS[o.status] ?? o.status,
  }))

  downloadCsv(toCsvString(rows, ORDER_HEADERS), filename)
}

// ─── Analytics top-items export ───────────────────────────────────────────────

interface TopItem { name: string; quantity: number; revenue: number }
interface ByWaiter { waiter_name: string; orders: number; revenue: number }

const TOP_ITEMS_HEADERS: Record<string, string> = {
  rank:     '#',
  name:     'Блюдо',
  quantity: 'Порций',
  revenue:  'Выручка',
}

export function exportTopItemsCsv(items: TopItem[], filename = 'top_items.csv') {
  const rows: CsvRow[] = items.map((item, i) => ({
    rank:     i + 1,
    name:     item.name,
    quantity: item.quantity,
    revenue:  formatUZS(item.revenue),
  }))
  downloadCsv(toCsvString(rows, TOP_ITEMS_HEADERS), filename)
}

const WAITERS_HEADERS: Record<string, string> = {
  waiter_name: 'Официант',
  orders:      'Заказов',
  revenue:     'Выручка',
  avg_order:   'Средний чек',
}

export function exportWaitersCsv(waiters: ByWaiter[], filename = 'waiters.csv') {
  const rows: CsvRow[] = waiters.map(w => ({
    waiter_name: w.waiter_name,
    orders:      w.orders,
    revenue:     formatUZS(w.revenue),
    avg_order:   formatUZS(w.orders > 0 ? Math.round(w.revenue / w.orders) : 0),
  }))
  downloadCsv(toCsvString(rows, WAITERS_HEADERS), filename)
}
