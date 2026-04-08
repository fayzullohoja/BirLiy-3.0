import { cn } from '@/lib/utils'

/**
 * Reusable labeled form field.
 *
 * Supports: text/number/date input, select, textarea.
 * Consistent styling across all forms — eliminates duplicated label+input patterns.
 *
 * Usage:
 *   <FormField label="Название *" value={name} onChange={setName} placeholder="Ош Маркази" />
 *   <FormField label="Тип" as="select" value={role} onChange={setRole}>
 *     <option value="owner">Владелец</option>
 *   </FormField>
 */

// ─── Types ────────────────────────────────────────────────────────────────────

interface BaseProps {
  label:       string
  error?:      string
  hint?:       string
  className?:  string
  required?:   boolean
}

interface InputProps extends BaseProps {
  as?:          'input'
  type?:        'text' | 'number' | 'date' | 'time' | 'email' | 'tel' | 'password'
  value:        string
  onChange:     (value: string) => void
  placeholder?: string
  min?:         string
  max?:         string
  step?:        string
  disabled?:    boolean
  autoFocus?:   boolean
}

interface SelectProps extends BaseProps {
  as:       'select'
  value:    string
  onChange: (value: string) => void
  children: React.ReactNode
  disabled?: boolean
}

interface TextareaProps extends BaseProps {
  as:           'textarea'
  value:        string
  onChange:     (value: string) => void
  placeholder?: string
  rows?:        number
  disabled?:    boolean
}

type FormFieldProps = InputProps | SelectProps | TextareaProps

// ─── Shared input class ───────────────────────────────────────────────────────

const inputBase = [
  'w-full px-3 py-2.5 rounded-xl',
  'border bg-surface-muted text-sm text-ink',
  'outline-none transition-colors',
  'focus:ring-2 focus:ring-brand-400 focus:border-brand-400',
  'disabled:opacity-50 disabled:cursor-not-allowed',
  'placeholder:text-ink-muted',
].join(' ')

// ─── Component ────────────────────────────────────────────────────────────────

export default function FormField(props: FormFieldProps) {
  const { label, error, hint, className, required } = props

  const borderClass = error
    ? 'border-red-400 focus:ring-red-300 focus:border-red-400'
    : 'border-surface-border'

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label className="text-xs font-semibold text-ink-secondary">
        {label}
        {required && <span className="text-danger ml-0.5">*</span>}
      </label>

      {props.as === 'select' ? (
        <select
          value={props.value}
          onChange={e => props.onChange(e.target.value)}
          disabled={props.disabled}
          className={cn(inputBase, borderClass, 'appearance-none cursor-pointer')}
        >
          {props.children}
        </select>
      ) : props.as === 'textarea' ? (
        <textarea
          value={props.value}
          onChange={e => props.onChange(e.target.value)}
          placeholder={props.placeholder}
          rows={props.rows ?? 3}
          disabled={props.disabled}
          className={cn(inputBase, borderClass, 'resize-none')}
        />
      ) : (
        <input
          type={props.type ?? 'text'}
          value={props.value}
          onChange={e => props.onChange(e.target.value)}
          placeholder={props.placeholder}
          min={props.min}
          max={props.max}
          step={props.step}
          disabled={props.disabled}
          autoFocus={props.autoFocus}
          className={cn(inputBase, borderClass)}
        />
      )}

      {error && (
        <p className="text-xs text-danger font-medium">{error}</p>
      )}
      {hint && !error && (
        <p className="text-xs text-ink-muted">{hint}</p>
      )}
    </div>
  )
}
