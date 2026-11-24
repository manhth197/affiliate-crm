import { apiRequest } from './client'
import type { AuthResponse, LoginRequest, Me, RegisterRequest, UpdateMeRequest } from './types'

export const authApi = {
  /** Also sets the httpOnly refresh cookie (hence `withCredentials`). */
  login: (body: LoginRequest) =>
    apiRequest<AuthResponse>('/auth/login', {
      method: 'POST',
      body,
      auth: false,
      withCredentials: true,
    }),

  register: (body: RegisterRequest) =>
    apiRequest<AuthResponse>('/auth/register', {
      method: 'POST',
      body,
      auth: false,
      withCredentials: true,
    }),

  me: () => apiRequest<Me>('/auth/me'),

  /** Own profile. Bank fields are for affiliates only (403 otherwise). */
  updateMe: (body: UpdateMeRequest) => apiRequest<Me>('/auth/me', { method: 'PATCH', body }),

  /** Revokes the refresh token in the cookie and clears the cookie (always 204). */
  logout: () =>
    apiRequest<void>('/auth/logout', { method: 'POST', body: {}, withCredentials: true }),
}
