import { cn } from 'cn'
import { Link, useLocation } from 'react-router'
import type { Role } from '@/api/types'
import { getNavItems, isNavItemActive } from '@/lib/navigation'

type SidebarNavProps = {
  role: Role
  /** Called after a link is clicked (closes the mobile drawer). */
  onNavigate?: () => void
}

export function SidebarNav({ role, onNavigate }: SidebarNavProps) {
  const { pathname } = useLocation()

  return (
    <nav aria-label="Menu chính" className="flex flex-col gap-1">
      {getNavItems(role).map((item) => {
        const active = isNavItemActive(item, pathname)
        const Icon = item.icon
        return (
          <Link
            key={`${item.to}-${item.label}`}
            to={item.to}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
              active && 'bg-muted text-foreground',
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
