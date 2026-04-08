'use client'

import { usePathname } from 'next/navigation'
import BottomNav from '@/components/layout/BottomNav'
import type { NavItem } from '@/components/layout/BottomNav'
import { WaiterSessionProvider } from './_context/WaiterSessionContext'

const NAV_ITEMS: NavItem[] = [
  {
    href:  '/waiter',
    label: 'Столы',
    icon:  <TableIcon />,
  },
  {
    href:  '/waiter/orders',
    label: 'Заказы',
    icon:  <OrderIcon />,
  },
  {
    href:  '/waiter/menu',
    label: 'Меню',
    icon:  <MenuIcon />,
  },
]

export default function WaiterLayout({ children }: { children: React.ReactNode }) {
  return (
    <WaiterSessionProvider>
      <WaiterLayoutInner>{children}</WaiterLayoutInner>
    </WaiterSessionProvider>
  )
}

function WaiterLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  // Hide bottom nav on table detail pages so the fixed action bar has room
  const hideNav = pathname.startsWith('/waiter/table/')

  return (
    <div className="min-h-screen bg-surface-muted">
      {children}
      {!hideNav && <BottomNav items={NAV_ITEMS} />}
    </div>
  )
}

// ─── Inline SVG icons ─────────────────────────────────────────────────────────

function TableIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="12" rx="2" />
      <path d="M9 15v6M15 15v6M6 21h12" />
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

function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  )
}
