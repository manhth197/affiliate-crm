import type { RouteObject } from 'react-router'
import { GuestOnly, RequireAuth, RequireRole } from '@/auth/guards'
import { AppLayout } from '@/components/layout/app-layout'
import { NotFoundScreen } from '@/components/status-screens'
import { AuthLayout } from '@/features/auth/auth-layout'
import { LoginPage } from '@/features/auth/login-page'
import { RegisterPage } from '@/features/auth/register-page'
import { DashboardPage } from '@/features/dashboard/dashboard-page'
import { CommissionsPage } from '@/features/finance/commissions-page'
import { PayoutsPage } from '@/features/finance/payouts-page'
import { LeadCreatePage } from '@/features/leads/lead-create-page'
import { LeadDetailPage } from '@/features/leads/lead-detail-page'
import { LeadsPage } from '@/features/leads/leads-page'
import { PlaceholderPage } from '@/pages/placeholder-page'
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
              { path: 'leads', element: <LeadsPage /> },
              {
                element: <RequireRole roles={['AFFILIATE']} />,
                children: [{ path: 'leads/new', element: <LeadCreatePage /> }],
              },
              { path: 'leads/:leadId', element: <LeadDetailPage /> },
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
                  { path: 'products', element: <PlaceholderPage title="Sản phẩm" /> },
                  { path: 'users', element: <PlaceholderPage title="Người dùng" /> },
                ],
              },
              {
                element: <RequireRole roles={['ADMIN', 'STAFF']} />,
                children: [{ path: 'reports', element: <PlaceholderPage title="Báo cáo" /> }],
              },
              { path: '*', element: <NotFoundScreen /> },
            ],
          },
        ],
      },
    ],
  },
]
