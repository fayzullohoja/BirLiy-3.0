import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Страница не найдена — BirLiy Kassa',
}

export default function NotFound() {
  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">

        <div className="w-20 h-20 rounded-3xl bg-gray-100 flex items-center justify-center mx-auto mb-6">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
            <path d="M11 8v3" />
            <path d="M11 14h.01" />
          </svg>
        </div>

        <p className="text-5xl font-bold text-gray-200 mb-2 tracking-tight">404</p>
        <h1 className="text-xl font-bold text-ink mb-2">Страница не найдена</h1>
        <p className="text-sm text-ink-secondary leading-relaxed mb-8">
          Такой страницы не существует или она была перемещена.
        </p>

        <Link
          href="/"
          className="inline-flex items-center justify-center w-full h-12 rounded-2xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 active:scale-95 transition-transform"
        >
          На главную
        </Link>

        <p className="mt-6 text-xs text-ink-muted">BirLiy Kassa</p>
      </div>
    </div>
  )
}
