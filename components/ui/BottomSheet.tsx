'use client'

import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

interface BottomSheetProps {
  open:        boolean
  onClose:     () => void
  title?:      string
  children:    React.ReactNode
  className?:  string
}

/**
 * Slide-up bottom sheet with backdrop.
 * Closes on backdrop click or Escape key.
 */
export function BottomSheet({ open, onClose, title, children, className }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  // Prevent scroll behind sheet
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative z-10 bg-surface rounded-t-2xl',
          'max-h-[90dvh] flex flex-col',
          'animate-slide-up',
          className,
        )}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-surface-border" />
        </div>

        {title && (
          <div className="px-4 pb-3 pt-1 shrink-0 border-b border-surface-border">
            <h2 className="text-base font-semibold text-ink">{title}</h2>
          </div>
        )}

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto overscroll-contain pb-safe">
          {children}
        </div>
      </div>
    </div>
  )
}
