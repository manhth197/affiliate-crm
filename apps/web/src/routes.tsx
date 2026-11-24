import type { ComponentType } from 'react'
import type { RouteObject } from 'react-router'
import { GuestOnly, RequireAuth, RequireRole } from '@/auth/guards'
import { AppLayout } from '@/components/layout/app-layout'
import { FullPageSpinner, NotFoundScreen } from '@/components/status-screens'
import { AuthLayout } from '@/features/auth/auth-layout'
import { LoginPage } from '@/features/auth/login-page'
import { RegisterPage } from '@/features/auth/register-page'
import { RouteErrorPage } from '@/pages/route-error-page'

/**
 * Route-level code splitting: each page is its own chunk, fetched when its route is first
 * matched (React Router's `lazy`). The shell, guards and the login/register pages stay in the
 * main bundle so a guest's first screen needs one request.
 */
function page<M>(load: () => Promise<M>, pick: (module: M) => ComponentType) {
  return { lazy: async () => ({ Component: pick(await load()) }) }
}

/**
 * Route tree. Access rules (keep in sync with NAV_ITEMS in lib/navigation.ts):
 * - /login, /register: guests only
 * - everything else: logged in; role groups wrapped in <RequireRole>
 */
export const routes: RouteObject[] = [
  {
    errorElement: <RouteErrorPage />,
    // Shown while the first matched page's chunk loads.
    hydrateFallbackElement: <FullPageSpinner />,
    children: [
      {
        element: <GuestOnly />,
        children: [
          {
            element: <AuthLayout />,
            children: [
              { path: 'login', element: <LoginPage /> },
              { path: 'register', element: <RegisterPage /> },
            ],
          },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          {
            element: <AppLayout />,
            children: [
              {
                index: true,
                ...page(
                  () => import('@/features/dashboard/dashboard-page'),
                  (m) => m.DashboardPage,
                ),
              },
              {
                path: 'leads',
                ...page(
                  () => import('@/features/leads/leads-route'),
                  (m) => m.LeadsRoute,
                ),
              },
              {
                element: <RequireRole roles={['AFFILIATE']} />,
                children: [
                  {
                    path: 'leads/new',
                    ...page(
                      () => import('@/features/leads/lead-create-page'),
                      (m) => m.LeadCreatePage,
                    ),
                  },
                ],
              },
              {
                path: 'leads/:leadId',
                ...page(
                  () => import('@/features/leads/lead-detail-page'),
                  (m) => m.LeadDetailPage,
                ),
              },
              {
                path: 'notifications',
                ...page(
                  () => import('@/features/notifications/notifications-page'),
                  (m) => m.NotificationsPage,
                ),
              },
              {
                path: 'profile',
                ...page(
                  () => import('@/features/profile/profile-page'),
                  (m) => m.ProfilePage,
                ),
              },
              {
                element: <RequireRole roles={['ADMIN', 'AFFILIATE']} />,
                children: [
                  {
                    path: 'commissions',
                    ...page(
                      () => import('@/features/finance/commissions-page'),
                      (m) => m.CommissionsPage,
                    ),
                  },
                  {
                    path: 'payouts',
                    ...page(
                      () => import('@/features/finance/payouts-page'),
                      (m) => m.PayoutsPage,
                    ),
                  },
                ],
              },
              {
                element: <RequireRole roles={['ADMIN']} />,
                children: [
                  {
                    path: 'products',
                    ...page(
                      () => import('@/features/catalog/products-page'),
                      (m) => m.ProductsPage,
                    ),
                  },
                  {
                    path: 'users',
                    ...page(
                      () => import('@/features/users/users-page'),
                      (m) => m.UsersPage,
                    ),
                  },
                ],
              },
              {
                element: <RequireRole roles={['ADMIN', 'STAFF']} />,
                children: [
                  {
                    path: 'reports',
                    ...page(
                      () => import('@/features/reports/reports-page'),
                      (m) => m.ReportsPage,
                    ),
                  },
                ],
              },
              { path: '*', element: <NotFoundScreen /> },
            ],
          },
        ],
      },
    ],
  },
]
