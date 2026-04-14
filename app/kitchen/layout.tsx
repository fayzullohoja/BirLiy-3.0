'use client'

import BottomNav from '@/components/layout/BottomNav'
import type { NavItem } from '@/components/layout/BottomNav'
import { KitchenSessionProvider } from './_context/KitchenSessionContext'
import { useAppLanguage } from '@/lib/useAppLanguage'

export default function KitchenLayout({ children }: { children: React.ReactNode }) {
  return (
    <KitchenSessionProvider>
      <KitchenLayoutInner>{children}</KitchenLayoutInner>
    </KitchenSessionProvider>
  )
}

function KitchenLayoutInner({ children }: { children: React.ReactNode }) {
  const { copy } = useAppLanguage()
  const navItems: NavItem[] = [
    {
      href: '/kitchen',
      label: copy.nav.kitchen,
      icon: <KitchenIcon />,
    },
    {
      href: '/kitchen/profile',
      label: copy.nav.profile,
      icon: <ProfileIcon />,
    },
  ]

  return (
    <div className="min-h-screen bg-surface-muted">
      {children}
      <BottomNav items={navItems} />
    </div>
  )
}

function KitchenIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 3h16v4H4z" />
      <path d="M6 7v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7" />
      <path d="M10 11h4" />
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
