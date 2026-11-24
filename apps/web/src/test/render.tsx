import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { tokenStore } from '@/api/token-store'
import { AppProviders } from '@/app-providers'
import { createQueryClient } from '@/lib/query-client'
import { findUserByEmail } from '@/mocks/db'
import { issueTokens } from '@/mocks/tokens'
import { connectMock } from '@/realtime/mock-connection'
import { routes } from '@/routes'

export type DemoEmail =
  'admin@demo.vn' | 'staff@demo.vn' | 'ctv1@demo.vn' | 'ctv2@demo.vn' | 'ctv3@demo.vn'

/** Start a session for a seed user directly in the mock DB (skips the login form). */
export function signInAs(email: DemoEmail) {
  const user = findUserByEmail(email)
  if (!user) throw new Error(`Unknown seed user ${email}`)
  tokenStore.setTokens(issueTokens(user.id))
  return user
}

/** Render the whole app (real routes, guards and providers) at `route`. */
export function renderApp(route = '/', { as }: { as?: DemoEmail } = {}) {
  if (as) signInAs(as)
  const queryClient = createQueryClient({ forTests: true })
  const router = createMemoryRouter(routes, { initialEntries: [route] })
  const user = userEvent.setup()
  const result = render(
    <AppProviders queryClient={queryClient} connectRealtime={connectMock}>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  return { ...result, router, user, queryClient }
}
