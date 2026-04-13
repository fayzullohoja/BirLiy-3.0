'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

export interface DashboardNavItemConfig {
  href: string
  label: string
  icon: React.ReactNode
  exact?: boolean
}

interface DashboardNavItemProps {
  item: DashboardNavItemConfig
  collapsed?: boolean
  onNavigate?: () => void
}

export default function DashboardNavItem({
  item,
  collapsed = false,
  onNavigate,
}: DashboardNavItemProps) {
  const pathname = usePathname()
  const isActive = item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`)

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        'flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold transition-colors',
        isActive
          ? 'bg-brand-600 text-white shadow-sm'
          : 'text-slate-300 hover:bg-slate-800 hover:text-white',
        collapsed && 'justify-center px-0',
      )}
      title={collapsed ? item.label : undefined}
    >
      <span className="shrink-0">{item.icon}</span>
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  )
}
