'use client'

import { useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import Button from '@/components/ui/Button'
import { useDashboardSession } from '@/components/dashboard/DashboardSessionContext'
import type { DashboardNavItemConfig } from '@/components/dashboard/NavItem'
import { signOutCurrentSession } from '@/lib/auth/clientAuth'

interface TopBarProps {
  navItems: DashboardNavItemConfig[]
  sectionLabel: string
  onOpenSidebar: () => void
}

export default function TopBar({ navItems, sectionLabel, onOpenSidebar }: TopBarProps) {
  const [signingOut, setSigningOut] = useState(false)
  const session = useDashboardSession()
  const pathname = usePathname()

  const pageTitle = useMemo(() => {
    const matched = navItems.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    if (matched) return matched.label
    const lastSegment = pathname.split('/').filter(Boolean).pop()
    return lastSegment ? humanizeSegment(lastSegment) : sectionLabel
  }, [navItems, pathname, sectionLabel])

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await signOutCurrentSession({ redirectTo: '/dashboard/login' })
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-surface-border bg-white/95 px-4 backdrop-blur md:px-6">
      <button
        type="button"
        aria-label="Открыть меню"
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-surface-border text-ink-secondary hover:bg-surface-muted md:hidden"
        onClick={onOpenSidebar}
      >
        <BurgerIcon />
      </button>

      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">
          {sectionLabel}
        </p>
        <h1 className="truncate text-lg font-bold text-ink">{pageTitle}</h1>
      </div>

      {session.shops.length > 0 && (
        <div className="hidden min-w-[220px] rounded-2xl border border-surface-border bg-surface-muted px-3 py-2 md:block">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">Заведение</p>
          {session.shops.length > 1 ? (
            <select
              value={session.selectedShopId ?? ''}
              onChange={(event) => session.setSelectedShopId(event.target.value)}
              className="mt-1 w-full rounded-xl border border-surface-border bg-white px-3 py-2 text-sm font-semibold text-ink outline-none focus:border-brand-500"
            >
              {session.shops.map((shop) => (
                <option key={shop.id} value={shop.id}>
                  {shop.name}
                </option>
              ))}
            </select>
          ) : (
            <p className="mt-1 max-w-[220px] truncate text-sm font-semibold text-ink">{session.shopName}</p>
          )}
        </div>
      )}

      <Button
        variant="secondary"
        size="sm"
        loading={signingOut}
        onClick={handleSignOut}
      >
        Выйти
      </Button>
    </header>
  )
}

function BurgerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M3 12h18" />
      <path d="M3 18h18" />
    </svg>
  )
}

function humanizeSegment(value: string) {
  if (/^\d+$/.test(value) || value.includes('-')) return 'Детали'
  return value.charAt(0).toUpperCase() + value.slice(1)
}
