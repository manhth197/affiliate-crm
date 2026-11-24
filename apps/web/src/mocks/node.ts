import { setupServer } from 'msw/node'
import { handlers } from './handlers'

/** Request interception for Vitest (same handlers as the browser). */
export const server = setupServer(...handlers)
