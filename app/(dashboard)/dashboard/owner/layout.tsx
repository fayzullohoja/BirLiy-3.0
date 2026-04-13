import DashboardLayout from '@/components/dashboard/DashboardLayout'
import { DashboardSessionProvider } from '@/components/dashboard/DashboardSessionContext'
import type { DashboardNavItemConfig } from '@/components/dashboard/NavItem'

const OWNER_ALLOWED_ROLES = ['owner', 'super_admin'] as const

const OWNER_NAV_ITEMS: DashboardNavItemConfig[] = [
  { href: '/dashboard/owner', label: 'Аналитика', icon: <ChartIcon />, exact: true },
  { href: '/dashboard/owner/orders', label: 'Заказы', icon: <OrdersIcon /> },
  { href: '/dashboard/owner/menu', label: 'Меню', icon: <MenuIcon /> },
  { href: '/dashboard/owner/tables', label: 'Столы', icon: <TablesIcon /> },
  { href: '/dashboard/owner/staff', label: 'Персонал', icon: <UsersIcon /> },
  { href: '/dashboard/owner/bookings', label: 'Бронирования', icon: <CalendarIcon /> },
  { href: '/dashboard/owner/settings', label: 'Настройки', icon: <SettingsIcon /> },
]

export default function DashboardOwnerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <DashboardSessionProvider allowedRoles={OWNER_ALLOWED_ROLES}>
      <DashboardLayout navItems={OWNER_NAV_ITEMS} sectionLabel="Заведение">
        {children}
      </DashboardLayout>
    </DashboardSessionProvider>
  )
}

function ChartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20V10" />
      <path d="M12 20V4" />
      <path d="M20 20v-7" />
    </svg>
  )
}

function OrdersIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 4H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="2" width="6" height="4" rx="1" />
      <path d="M9 12h6" />
      <path d="M9 16h4" />
    </svg>
  )
}

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </svg>
  )
}

function TablesIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="11" rx="2" />
      <path d="M9 15v6" />
      <path d="M15 15v6" />
      <path d="M6 21h12" />
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

function CalendarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4" />
      <path d="M8 2v4" />
      <path d="M3 10h18" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1 .6 1.65 1.65 0 0 1-2 0 1.65 1.65 0 0 0-1-.6 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-.6-1 1.65 1.65 0 0 1 0-2 1.65 1.65 0 0 0 .6-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-.6 1.65 1.65 0 0 1 2 0 1.65 1.65 0 0 0 1 .6 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.24.31.44.65.6 1a1.65 1.65 0 0 1 0 2c-.16.35-.36.69-.6 1Z" />
    </svg>
  )
}
