import { createBrowserRouter, RouterProvider } from 'react-router'
import { AppProviders } from '@/app-providers'
import { createQueryClient } from '@/lib/query-client'
import { routes } from '@/routes'

const queryClient = createQueryClient()
const router = createBrowserRouter(routes)

export default function App() {
  return (
    <AppProviders queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>
  )
}
