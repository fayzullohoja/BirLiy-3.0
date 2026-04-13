'use client'

import { useEffect, useState } from 'react'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export default function SearchInput({
  value,
  onChange,
  placeholder = 'Поиск',
  className,
}: SearchInputProps) {
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    setDraft(value)
  }, [value])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (draft !== value) onChange(draft)
    }, 300)

    return () => window.clearTimeout(timeoutId)
  }, [draft, onChange, value])

  function clear() {
    setDraft('')
    onChange('')
  }

  return (
    <div className={['relative flex h-10 items-center rounded-xl border border-surface-border bg-surface-muted px-3', className].filter(Boolean).join(' ')}>
      <SearchIcon />
      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={placeholder}
        className="h-full flex-1 bg-transparent px-2 text-sm text-ink outline-none placeholder:text-ink-muted"
      />
      {draft && (
        <button
          type="button"
          onClick={clear}
          aria-label="Очистить поиск"
          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-ink-muted hover:bg-white"
        >
          <ClearIcon />
        </button>
      )}
    </div>
  )
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" className="text-ink-muted">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}

function ClearIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}
