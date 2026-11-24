import { createContext, useContext } from 'react'
import type { LoginRequest, Me, RegisterRequest } from '@/api/types'

export const ME_QUERY_KEY = ['auth', 'me'] as const

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'error'

export type AuthContextValue = {
  status: AuthStatus
  user: Me | null
  login: (body: LoginRequest) => Promise<Me>
  register: (body: RegisterRequest) => Promise<Me>
  logout: () => Promise<void>
  /** Retry loading the profile after a network/server error. */
  retry: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')
  return context
}

/** For components that only render inside <RequireAuth>. */
export function useCurrentUser(): Me {
  const { user } = useAuth()
  if (!user) throw new Error('useCurrentUser must be used inside an authenticated route')
  return user
}
