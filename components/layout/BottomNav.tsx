'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

export interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
  activeIcon?: React.ReactNode
  badge?: number
}

interface BottomNavProps {
  items: NavItem[]
  className?: string
}

/**
 * Fixed bottom navigation bar.
 * Height matches --nav-height CSS variable (64px).
 * Automatically highlights the active route via usePathname.
 */
export default function BottomNav({ items, className }: BottomNavProps) {
  const pathname = usePathname()

  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-40',
        'flex items-stretch h-16 pb-safe',
        'bg-surface border-t border-surface-border',
        'shadow-[0_-1px_3px_0_rgb(0_0_0_/_0.06)]',
        className,
      )}
    >
      {items.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex-1 flex flex-col items-center justify-center gap-0.5',
              'text-xs font-medium transition-colors duration-150',
              'relative',
              isActive ? 'text-brand-600' : 'text-ink-muted',
            )}
          >
            {/* Active indicator pill */}
            {isActive && (
              <span
                className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-brand-600"
                aria-hidden
              />
            )}

            {/* Icon */}
            <span className="relative">
              {isActive && item.activeIcon ? item.activeIcon : item.icon}
              {/* Badge */}
              {item.badge !== undefined && item.badge > 0 && (
                <span
                  className={cn(
                    'absolute -top-1.5 -right-2',
                    'min-w-[18px] h-[18px] px-1',
                    'flex items-center justify-center',
                    'rounded-full bg-danger text-white text-[10px] font-bold',
                  )}
                >
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </span>

            <span className="leading-tight">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
