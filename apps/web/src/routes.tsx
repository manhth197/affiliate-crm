import type { RouteObject } from 'react-router'
import { GuestOnly, RequireAuth, RequireRole } from '@/auth/guards'
import { AppLayout } from '@/components/layout/app-layout'
import { NotFoundScreen } from '@/components/status-screens'
import { AuthLayout } from '@/pages/auth/auth-layout'
import { LoginPage } from '@/pages/auth/login-page'
import { RegisterPage } from '@/pages/auth/register-page'
import { DashboardPage } from '@/pages/dashboard-page'
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
              {
                path: 'leads',
                element: <PlaceholderPage title="Danh sách lead" />,
              },
              {
                element: <RequireRole roles={['AFFILIATE']} />,
                children: [
                  {
                    path: 'leads/new',
                    element: <PlaceholderPage title="Giới thiệu khách hàng" />,
                  },
                ],
              },
              { path: 'leads/:leadId', element: <PlaceholderPage title="Chi tiết lead" /> },
              {
                element: <RequireRole roles={['ADMIN', 'AFFILIATE']} />,
                children: [
                  { path: 'commissions', element: <PlaceholderPage title="Hoa hồng" /> },
                  { path: 'payouts', element: <PlaceholderPage title="Chi trả" /> },
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
