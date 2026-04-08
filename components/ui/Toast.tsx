'use client'

/**
 * Lightweight toast notification system.
 *
 * Design: module-level event emitter — no React Context required.
 * Usage (from any client component or event handler):
 *
 *   import { toast } from '@/components/ui/Toast'
 *   toast.success('Сохранено')
 *   toast.error('Ошибка сохранения')
 *   toast.info('Обновлено')
 *
 * Mount <Toaster /> once in the root layout.
 */

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type ToastType = 'success' | 'error' | 'info'

interface ToastItem {
  id:      string
  type:    ToastType
  message: string
}

// ─── Module-level state (no React context needed) ────────────────────────────

type Listener = (items: ToastItem[]) => void

let _items: ToastItem[]    = []
let _listeners: Listener[] = []

function _emit() {
  const snapshot = [..._items]
  _listeners.forEach(fn => fn(snapshot))
}

function _add(type: ToastType, message: string) {
  const id      = Math.random().toString(36).slice(2, 9)
  const timeout = type === 'error' ? 4500 : 3000
  _items = [..._items, { id, type, message }]
  _emit()
  setTimeout(() => {
    _items = _items.filter(t => t.id !== id)
    _emit()
  }, timeout)
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const toast = {
  success: (message: string) => _add('success', message),
  error:   (message: string) => _add('error',   message),
  info:    (message: string) => _add('info',     message),
}

// ─── Toaster component ────────────────────────────────────────────────────────

const ICON: Record<ToastType, React.ReactNode> = {
  success: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  error: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  info: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
}

const STYLES: Record<ToastType, string> = {
  success: 'bg-green-50  border-green-200  text-green-800',
  error:   'bg-red-50    border-red-200    text-red-800',
  info:    'bg-blue-50   border-blue-200   text-blue-800',
}

const DOT_STYLES: Record<ToastType, string> = {
  success: 'bg-green-500',
  error:   'bg-red-500',
  info:    'bg-blue-500',
}

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([])

  useEffect(() => {
    _listeners.push(setItems)
    return () => {
      _listeners = _listeners.filter(l => l !== setItems)
    }
  }, [])

  if (items.length === 0) return null

  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="fixed top-0 left-0 right-0 z-[100] flex flex-col items-center gap-2 px-4 pt-safe pt-3 pointer-events-none"
    >
      {items.map(item => (
        <div
          key={item.id}
          role="alert"
          className={cn(
            'w-full max-w-sm flex items-center gap-3 px-4 py-3',
            'rounded-2xl border shadow-card-md',
            'animate-toast-in pointer-events-auto',
            STYLES[item.type],
          )}
        >
          {/* Icon dot */}
          <span className={cn('w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-white', DOT_STYLES[item.type])}>
            {ICON[item.type]}
          </span>
          <p className="text-sm font-semibold leading-snug flex-1">{item.message}</p>
        </div>
      ))}
    </div>
  )
}
