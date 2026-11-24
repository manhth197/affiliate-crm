import { QueryClient } from '@tanstack/react-query'
import { isApiError } from '@/api/errors'

/** Client errors (4xx) will not succeed on retry; network errors and 5xx get two more tries. */
function shouldRetry(failureCount: number, error: unknown) {
  if (isApiError(error) && error.status >= 400 && error.status < 500) return false
  return failureCount < 2
}

export function createQueryClient({ forTests = false } = {}) {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: forTests ? false : shouldRetry,
      },
      mutations: { retry: false },
    },
  })
}
