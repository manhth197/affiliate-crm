import { Navigate, Outlet, useLocation, type Location } from 'react-router'
import type { Role } from '@/api/types'
import { ErrorScreen, ForbiddenScreen, FullPageSpinner } from '@/components/status-screens'
import { useAuth } from './auth-context'
import { hasRole } from './roles'

/** Location state set when a guard sends the user to /login. */
export type LoginRedirectState = { from?: Pick<Location, 'pathname' | 'search'> }

/** Only logged-in users get through; others go to /login and come back afterwards. */
export function RequireAuth() {
  const { status, retry } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <FullPageSpinner />
  if (status === 'error') {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <ErrorScreen onRetry={retry} />
      </div>
    )
  }
  if (status === 'unauthenticated') {
    const state: LoginRedirectState = {
      from: { pathname: location.pathname, search: location.search },
    }
    return <Navigate to="/login" replace state={state} />
  }
  return <Outlet />
}

/**
 * Role check for a group of routes. Renders a 403 screen instead of redirecting, so the URL
 * stays and the user understands why. The API enforces the same rules; this is only UX.
 */
export function RequireRole({ roles }: { roles: readonly Role[] }) {
  const { user } = useAuth()
  if (!hasRole(user?.role, roles)) return <ForbiddenScreen />
  return <Outlet />
}

/** Login/register pages: a logged-in user is sent back to where they came from (or home). */
export function GuestOnly() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <FullPageSpinner />
  if (status === 'authenticated') {
    const from = (location.state as LoginRedirectState | null)?.from
    const target = from && from.pathname !== '/login' ? `${from.pathname}${from.search}` : '/'
    return <Navigate to={target} replace />
  }
  return <Outlet />
}
