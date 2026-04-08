import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { ApiError, ApiResponse, ApiSuccess } from './types'

// ─── Class Name Utility ───────────────────────────────────────────────────────

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ─── Currency Formatting ──────────────────────────────────────────────────────

const UZS_FORMATTER = new Intl.NumberFormat('uz-UZ', {
  style: 'decimal',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
  useGrouping: true,
})

/**
 * Format a number as UZS currency.
 * Example: formatUZS(12500) → "12 500 сум"
 */
export function formatUZS(amount: number): string {
  return `${UZS_FORMATTER.format(amount)} сум`
}

/**
 * Format a number with thousands separator only (no currency label).
 * Example: formatAmount(12500) → "12 500"
 */
export function formatAmount(amount: number): string {
  return UZS_FORMATTER.format(amount)
}

// ─── Date / Time Utilities ────────────────────────────────────────────────────

/**
 * Format ISO date string to HH:mm (Tashkent time, UTC+5).
 */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tashkent',
  })
}

/**
 * Format ISO date string to "DD MMM" in Russian, e.g. "7 апр".
 */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Tashkent',
  })
}

// ─── API Response Helpers ─────────────────────────────────────────────────────

export function ok<T>(data: T): ApiSuccess<T> {
  return { data, error: null }
}

export function err(code: string, message: string): ApiError {
  return { data: null, error: { code, message } }
}

export function isApiError<T>(res: ApiResponse<T>): res is ApiError {
  return res.error !== null
}

// ─── Table Status Labels ──────────────────────────────────────────────────────

export const TABLE_STATUS_LABELS: Record<string, string> = {
  free:             'Свободен',
  occupied:         'Занят',
  reserved:         'Забронирован',
  bill_requested:   'Счёт',
}

export const PAYMENT_TYPE_LABELS: Record<string, string> = {
  cash:     'Наличные',
  card:     'Терминал',
  payme:    'PayMe',
  click:    'Click',
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  open:        'Открыт',
  in_kitchen:  'На кухне',
  ready:       'Готов',
  paid:        'Оплачен',
  cancelled:   'Отменён',
}

// ─── Misc ─────────────────────────────────────────────────────────────────────

export function pluralRu(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return `${n} ${one}`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${n} ${few}`
  return `${n} ${many}`
}
