'use client'

import { usePathname } from 'next/navigation'
import BottomNav from '@/components/layout/BottomNav'
import type { NavItem } from '@/components/layout/BottomNav'

const NAV_ITEMS: NavItem[] = [
  { href: '/admin',               label: 'Обзор',       icon: <OverviewIcon /> },
  { href: '/admin/restaurants',   label: 'Заведения',   icon: <RestaurantIcon /> },
  { href: '/admin/users',         label: 'Пользователи', icon: <UsersIcon /> },
  { href: '/admin/subscriptions', label: 'Подписки',    icon: <SubIcon /> },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  // Hide bottom nav on nested detail pages
  const hideNav = pathname.startsWith('/admin/restaurants/')

  return (
    <div className="min-h-screen bg-surface-muted">
      {children}
      {!hideNav && <BottomNav items={NAV_ITEMS} />}
    </div>
  )
}

function OverviewIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}

function RestaurantIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function SubIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  )
}
