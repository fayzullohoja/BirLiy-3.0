'use client'

import { cn } from '@/lib/utils'
import DashboardNavItem, { type DashboardNavItemConfig } from '@/components/dashboard/NavItem'

interface SidebarProps {
  title: string
  subtitle: string
  items: DashboardNavItemConfig[]
  collapsed: boolean
  mobileOpen: boolean
  onToggle: () => void
  onCloseMobile: () => void
}

export default function Sidebar({
  title,
  subtitle,
  items,
  collapsed,
  mobileOpen,
  onToggle,
  onCloseMobile,
}: SidebarProps) {
  return (
    <>
      {mobileOpen && (
        <button
          aria-label="Закрыть навигацию"
          className="fixed inset-0 z-30 bg-slate-950/45 md:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex flex-col bg-slate-950 text-white transition-all duration-200',
          collapsed ? 'w-[92px]' : 'w-[272px]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
      >
        <div className="flex items-center gap-3 border-b border-slate-800 px-4 py-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-600 font-bold">
            B
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-bold">{title}</p>
              <p className="truncate text-xs text-slate-400">{subtitle}</p>
            </div>
          )}
          <button
            type="button"
            aria-label={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
            className="hidden h-9 w-9 items-center justify-center rounded-xl text-slate-300 hover:bg-slate-800 md:flex"
            onClick={onToggle}
          >
            <ChevronIcon collapsed={collapsed} />
          </button>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto px-3 py-4">
          {items.map((item) => (
            <DashboardNavItem
              key={item.href}
              item={item}
              collapsed={collapsed}
              onNavigate={onCloseMobile}
            />
          ))}
        </nav>
      </aside>
    </>
  )
}

function ChevronIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('transition-transform', collapsed && 'rotate-180')}
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  )
}
