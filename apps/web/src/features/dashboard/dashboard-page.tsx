import { useCurrentUser } from '@/auth/auth-context'
import { AffiliateDashboard } from './affiliate-dashboard'
import { BackOfficeDashboard } from './back-office-dashboard'

export function DashboardPage() {
  const user = useCurrentUser()
  return user.role === 'AFFILIATE' ? (
    <AffiliateDashboard user={user} />
  ) : (
    <BackOfficeDashboard user={user} />
  )
}
