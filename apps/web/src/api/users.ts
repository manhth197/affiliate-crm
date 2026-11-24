import { apiRequest } from './client'
import type { components } from './schema.gen'
import type { PageQuery, Paginated, Role, User, UserStatus } from './types'

export type CreateUserRequest = components['schemas']['CreateUserRequest']
export type UpdateUserRequest = components['schemas']['UpdateUserRequest']
export type UserQuery = PageQuery & { role?: Role; status?: UserStatus; q?: string }

/** ADMIN only. */
export const usersApi = {
  list: (query: UserQuery, signal?: AbortSignal) =>
    apiRequest<Paginated<User>>('/users', { query, signal }),

  /** Creates a STAFF or ADMIN account. 409 EMAIL_TAKEN if the email exists. */
  create: (body: CreateUserRequest) => apiRequest<User>('/users', { method: 'POST', body }),

  /** Disabling ends the user's sessions; admins cannot disable themselves (422). */
  update: (id: string, body: UpdateUserRequest) =>
    apiRequest<User>(`/users/${encodeURIComponent(id)}`, { method: 'PATCH', body }),
}
