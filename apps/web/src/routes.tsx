import type { RouteObject } from 'react-router'
import { GuestOnly, RequireAuth, RequireRole } from '@/auth/guards'
import { AppLayout } from '@/components/layout/app-layout'
import { NotFoundScreen } from '@/components/status-screens'
import { AuthLayout } from '@/features/auth/auth-layout'
import { LoginPage } from '@/features/auth/login-page'
import { RegisterPage } from '@/features/auth/register-page'
import { ProductsPage } from '@/features/catalog/products-page'
import { DashboardPage } from '@/features/dashboard/dashboard-page'
import { CommissionsPage } from '@/features/finance/commissions-page'
import { PayoutsPage } from '@/features/finance/payouts-page'
import { LeadCreatePage } from '@/features/leads/lead-create-page'
import { LeadDetailPage } from '@/features/leads/lead-detail-page'
import { LeadsRoute } from '@/features/leads/leads-route'
import { NotificationsPage } from '@/features/notifications/notifications-page'
import { ProfilePage } from '@/features/profile/profile-page'
import { ReportsRoute } from '@/features/reports/reports-route'
import { UsersPage } from '@/features/users/users-page'
import { RouteErrorPage } from '@/pages/route-error-page'

/**
 * Route tree. Access rules (keep in sync with NAV_ITEMS in lib/navigation.ts):
 * - /login, /register: guests only
 * - everything else: logged in; role groups wrapped in <RequireRole>
 */
export const routes: RouteObject[] = [
  {
    errorElement: <RouteErrorPage />,
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
              { index: true, element: <DashboardPage /> },
              { path: 'leads', element: <LeadsRoute /> },
              {
                element: <RequireRole roles={['AFFILIATE']} />,
                children: [{ path: 'leads/new', element: <LeadCreatePage /> }],
              },
              { path: 'leads/:leadId', element: <LeadDetailPage /> },
              { path: 'notifications', element: <NotificationsPage /> },
              { path: 'profile', element: <ProfilePage /> },
              {
                element: <RequireRole roles={['ADMIN', 'AFFILIATE']} />,
                children: [
                  { path: 'commissions', element: <CommissionsPage /> },
                  { path: 'payouts', element: <PayoutsPage /> },
                ],
              },
              {
                element: <RequireRole roles={['ADMIN']} />,
                children: [
                  { path: 'products', element: <ProductsPage /> },
                  { path: 'users', element: <UsersPage /> },
                ],
              },
              {
                element: <RequireRole roles={['ADMIN', 'STAFF']} />,
                children: [
                  {
                    path: 'reports',
                    element: <ReportsRoute />,
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
