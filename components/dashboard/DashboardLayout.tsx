'use client'

import { useState } from 'react'
import Sidebar from '@/components/dashboard/Sidebar'
import TopBar from '@/components/dashboard/TopBar'
import { useDashboardSession } from '@/components/dashboard/DashboardSessionContext'
import type { DashboardNavItemConfig } from '@/components/dashboard/NavItem'

interface DashboardLayoutProps {
  children: React.ReactNode
  navItems: DashboardNavItemConfig[]
  sectionLabel: string
}

export default function DashboardLayout({
  children,
  navItems,
  sectionLabel,
}: DashboardLayoutProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const session = useDashboardSession()
  const filteredNavItems = navItems.filter((item) => {
    if (!item.allowedRoles || !session.role) return true
    return item.allowedRoles.includes(session.role)
  })

  if (session.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-muted px-4">
        <div className="rounded-3xl border border-surface-border bg-white px-8 py-10 text-center shadow-card">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-surface-border border-t-brand-600" />
          <h1 className="text-lg font-bold text-ink">Загружаем панель</h1>
          <p className="mt-2 text-sm text-ink-secondary">Проверяем сессию и права доступа.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-muted">
      <Sidebar
        title="BirLiy Kassa"
        subtitle="Web Dashboard"
        items={filteredNavItems}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onToggle={() => setCollapsed((prev) => !prev)}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className={collapsed ? 'md:pl-[92px]' : 'md:pl-[272px]'}>
        <TopBar
          navItems={filteredNavItems}
          sectionLabel={sectionLabel}
          onOpenSidebar={() => setMobileOpen(true)}
        />
        <main className="px-4 py-6 md:px-6">
          {children}
        </main>
      </div>
    </div>
  )
}
