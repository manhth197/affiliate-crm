import { useQuery, useQueryClient } from '@tanstack/react-query'
import { type ReactNode, useCallback, useEffect, useMemo, useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import { authApi } from '@/api/auth'
import { onSessionExpired } from '@/api/client'
import { tokenStore } from '@/api/token-store'
import type { LoginRequest, Me, RegisterRequest } from '@/api/types'
import { AuthContext, type AuthStatus, ME_QUERY_KEY } from './auth-context'

const LOGOUT_TIMEOUT_MS = 3000

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  // Whether a refresh token exists (also updated by other tabs through the storage event).
  const hasSession = useSyncExternalStore(tokenStore.subscribe, tokenStore.hasSession)

  const meQuery = useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: authApi.me,
    enabled: hasSession,
    staleTime: Infinity,
    retry: false,
  })

  // When the session ends (logout, rejected refresh, other tab), drop every cached response
  // so the next user never sees the previous user's data.
  useEffect(
    () =>
      tokenStore.subscribe(() => {
        if (!tokenStore.hasSession()) queryClient.clear()
      }),
    [queryClient],
  )

  useEffect(
    () =>
      onSessionExpired(() => {
        toast.warning('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.')
      }),
    [],
  )

  const startSession = useCallback(
    (response: { user: Me; accessToken: string; refreshToken: string }) => {
      // Fill the cache first so flipping `hasSession` does not trigger an extra /auth/me call.
      queryClient.setQueryData(ME_QUERY_KEY, response.user)
      tokenStore.setTokens(response)
      return response.user
    },
    [queryClient],
  )

  const login = useCallback(
    async (body: LoginRequest) => startSession(await authApi.login(body)),
    [startSession],
  )

  const register = useCallback(
    async (body: RegisterRequest) => startSession(await authApi.register(body)),
    [startSession],
  )

  const logout = useCallback(async () => {
    // Best effort: revoke the refresh token, but never keep the user waiting on a slow API.
    await Promise.race([
      authApi.logout().catch(() => undefined),
      new Promise((resolve) => setTimeout(resolve, LOGOUT_TIMEOUT_MS)),
    ])
    tokenStore.clear()
  }, [])

  const { refetch } = meQuery
  const retry = useCallback(() => void refetch(), [refetch])

  let status: AuthStatus
  if (!hasSession) status = 'unauthenticated'
  else if (meQuery.data) status = 'authenticated'
  else if (meQuery.isError) status = 'error'
  else status = 'loading'

  const user = status === 'authenticated' ? (meQuery.data ?? null) : null

  const value = useMemo(
    () => ({ status, user, login, register, logout, retry }),
    [status, user, login, register, logout, retry],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
