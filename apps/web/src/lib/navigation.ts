import {
  BarChart3,
  FilePlus2,
  KanbanSquare,
  LayoutDashboard,
  ListChecks,
  type LucideIcon,
  Package,
  Users,
  Wallet,
  WalletCards,
} from 'lucide-react'
import type { Role } from '@/api/types'

export type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  roles: readonly Role[]
  /** Paths that start with `to` but belong to another menu item. */
  exclude?: readonly string[]
}

/**
 * Sidebar menu per role. Route access is enforced separately by <RequireRole> in routes.tsx;
 * a test checks that every item here points to a route the role is allowed to open.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/', label: 'Tổng quan', icon: LayoutDashboard, roles: ['ADMIN', 'STAFF', 'AFFILIATE'] },
  {
    to: '/leads',
    label: 'Lead của tôi',
    icon: ListChecks,
    roles: ['AFFILIATE'],
    exclude: ['/leads/new'],
  },
  { to: '/leads/new', label: 'Giới thiệu khách hàng', icon: FilePlus2, roles: ['AFFILIATE'] },
  { to: '/leads', label: 'Pipeline', icon: KanbanSquare, roles: ['ADMIN', 'STAFF'] },
  { to: '/commissions', label: 'Hoa hồng', icon: Wallet, roles: ['ADMIN', 'AFFILIATE'] },
  { to: '/payouts', label: 'Chi trả', icon: WalletCards, roles: ['ADMIN', 'AFFILIATE'] },
  { to: '/products', label: 'Sản phẩm', icon: Package, roles: ['ADMIN'] },
  { to: '/users', label: 'Người dùng', icon: Users, roles: ['ADMIN'] },
  { to: '/reports', label: 'Báo cáo', icon: BarChart3, roles: ['ADMIN', 'STAFF'] },
]

export function getNavItems(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role))
}

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.exclude?.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return false
  }
  if (item.to === '/') return pathname === '/'
  return pathname === item.to || pathname.startsWith(`${item.to}/`)
}
