'use client'

import { usePathname } from 'next/navigation'
import BottomNav from '@/components/layout/BottomNav'
import type { NavItem } from '@/components/layout/BottomNav'
import { OwnerSessionProvider } from './_context/OwnerSessionContext'
import { useAppLanguage } from '@/lib/useAppLanguage'

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <OwnerSessionProvider>
      <OwnerLayoutInner>{children}</OwnerLayoutInner>
    </OwnerSessionProvider>
  )
}

function OwnerLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { copy } = useAppLanguage()
  const navItems: NavItem[] = [
    {
      href:  '/owner',
      label: copy.nav.analytics,
      icon:  <ChartIcon />,
    },
    {
      href:  '/owner/orders',
      label: copy.nav.orders,
      icon:  <OrderIcon />,
    },
    {
      href:  '/owner/tables',
      label: copy.nav.tables,
      icon:  <TableIcon />,
    },
    {
      href:  '/owner/menu',
      label: copy.nav.menu,
      icon:  <MenuIcon />,
    },
    {
      href:  '/owner/profile',
      label: copy.nav.profile,
      icon:  <ProfileIcon />,
    },
  ]
  // Hide nav on order detail pages
  const hideNav  = pathname.startsWith('/owner/orders/')

  return (
    <div className="min-h-screen bg-surface-muted">
      {children}
      {!hideNav && <BottomNav items={navItems} />}
    </div>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function ChartIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6"  y1="20" x2="6"  y2="14" />
    </svg>
  )
}

function OrderIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="M9 12h6M9 16h4" />
    </svg>
  )
}

function TableIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="12" rx="2" />
      <path d="M9 15v6M15 15v6M6 21h12" />
    </svg>
  )
}

function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  )
}

function ProfileIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21a8 8 0 0 0-16 0" />
      <circle cx="12" cy="8" r="4" />
    </svg>
  )
}
