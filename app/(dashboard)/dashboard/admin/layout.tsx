import DashboardLayout from '@/components/dashboard/DashboardLayout'
import { DashboardSessionProvider } from '@/components/dashboard/DashboardSessionContext'
import type { DashboardNavItemConfig } from '@/components/dashboard/NavItem'

const ADMIN_ALLOWED_ROLES = ['super_admin'] as const

const ADMIN_NAV_ITEMS: DashboardNavItemConfig[] = [
  { href: '/dashboard/admin', label: 'Обзор', icon: <OverviewIcon />, exact: true },
  { href: '/dashboard/admin/restaurants', label: 'Заведения', icon: <RestaurantIcon /> },
  { href: '/dashboard/admin/users', label: 'Пользователи', icon: <UsersIcon /> },
  { href: '/dashboard/admin/subscriptions', label: 'Подписки', icon: <SubscriptionsIcon /> },
]

export default function DashboardAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <DashboardSessionProvider allowedRoles={ADMIN_ALLOWED_ROLES}>
      <DashboardLayout navItems={ADMIN_NAV_ITEMS} sectionLabel="Платформа">
        {children}
      </DashboardLayout>
    </DashboardSessionProvider>
  )
}

function OverviewIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.2" />
      <rect x="14" y="3" width="7" height="7" rx="1.2" />
      <rect x="3" y="14" width="7" height="7" rx="1.2" />
      <rect x="14" y="14" width="7" height="7" rx="1.2" />
    </svg>
  )
}

function RestaurantIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9 12 3l9 6v11a1.8 1.8 0 0 1-1.8 1.8H4.8A1.8 1.8 0 0 1 3 20Z" />
      <path d="M9 21v-7h6v7" />
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2.2A3.8 3.8 0 0 0 13.2 15H6.8A3.8 3.8 0 0 0 3 18.8V21" />
      <circle cx="10" cy="7" r="4" />
      <path d="M21 21v-2.2A3.8 3.8 0 0 0 18 15.13" />
      <path d="M14 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function SubscriptionsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
      <path d="M7 15h4" />
    </svg>
  )
}
