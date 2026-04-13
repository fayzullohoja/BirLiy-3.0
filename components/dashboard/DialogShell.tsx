'use client'

import Button from '@/components/ui/Button'

interface DialogShellProps {
  title: string
  description?: string
  children: React.ReactNode
  onClose: () => void
  maxWidthClassName?: string
}

export default function DialogShell({
  title,
  description,
  children,
  onClose,
  maxWidthClassName = 'max-w-2xl',
}: DialogShellProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Закрыть окно"
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
      />
      <div className={`relative z-10 w-full rounded-3xl border border-surface-border bg-white p-6 shadow-card-md ${maxWidthClassName}`}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-ink">{title}</h2>
            {description && <p className="mt-2 text-sm text-ink-secondary">{description}</p>}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>Закрыть</Button>
        </div>
        {children}
      </div>
    </div>
  )
}
