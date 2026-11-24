import { apiRequest } from './client'
import { tokenStore } from './token-store'
import type { AuthResponse, LoginRequest, Me, RegisterRequest, UpdateMeRequest } from './types'

export const authApi = {
  login: (body: LoginRequest) =>
    apiRequest<AuthResponse>('/auth/login', { method: 'POST', body, auth: false }),

  register: (body: RegisterRequest) =>
    apiRequest<AuthResponse>('/auth/register', { method: 'POST', body, auth: false }),

  me: () => apiRequest<Me>('/auth/me'),

  /** Own profile. Bank fields are for affiliates only (403 otherwise). */
  updateMe: (body: UpdateMeRequest) => apiRequest<Me>('/auth/me', { method: 'PATCH', body }),

  /** Revokes the refresh token on the server. The token is read at send time (it may rotate). */
  logout: () =>
    apiRequest<void>('/auth/logout', {
      method: 'POST',
      body: () => ({ refreshToken: tokenStore.getRefreshToken() }),
    }),
}
