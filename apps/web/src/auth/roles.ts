import type { Role } from '@/api/types'

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Quản trị viên',
  STAFF: 'Nhân viên',
  AFFILIATE: 'Cộng tác viên',
}

export const ALL_ROLES: readonly Role[] = ['ADMIN', 'STAFF', 'AFFILIATE']
export const BACK_OFFICE_ROLES: readonly Role[] = ['ADMIN', 'STAFF']

export function hasRole(role: Role | undefined, allowed: readonly Role[]): boolean {
  return role !== undefined && allowed.includes(role)
}
