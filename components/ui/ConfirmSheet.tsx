/**
 * Reusable destructive-action confirmation bottom sheet.
 *
 * Replaces the repeated "confirm delete" pattern across admin and owner pages.
 *
 * Usage:
 *   <ConfirmSheet
 *     open={!!deleteTarget}
 *     onClose={() => setDeleteTarget(null)}
 *     onConfirm={handleDelete}
 *     loading={deleting}
 *     title="Удалить стол?"
 *     description="Это действие необратимо."
 *     confirmLabel="Удалить"
 *   />
 */

import { BottomSheet } from '@/components/ui/BottomSheet'
import Button from '@/components/ui/Button'

interface ConfirmSheetProps {
  open:          boolean
  onClose:       () => void
  onConfirm:     () => void
  loading?:      boolean
  title:         string
  description?:  string
  confirmLabel?: string
  cancelLabel?:  string
  /** When true, uses a warning (amber) style instead of danger (red). Default: false */
  warning?:      boolean
}

export default function ConfirmSheet({
  open,
  onClose,
  onConfirm,
  loading    = false,
  title,
  description,
  confirmLabel = 'Удалить',
  cancelLabel  = 'Отмена',
  warning      = false,
}: ConfirmSheetProps) {
  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      <div className="px-4 py-4 flex flex-col gap-3">
        {description && (
          <p className="text-sm text-ink-secondary leading-relaxed">{description}</p>
        )}

        <Button
          variant={warning ? 'outline' : 'danger'}
          size="md"
          fullWidth
          loading={loading}
          onClick={onConfirm}
          className={warning ? 'border-amber-500 text-amber-700 hover:bg-amber-50' : ''}
        >
          {confirmLabel}
        </Button>

        <Button
          variant="ghost"
          size="md"
          fullWidth
          onClick={onClose}
          disabled={loading}
        >
          {cancelLabel}
        </Button>
      </div>
    </BottomSheet>
  )
}
