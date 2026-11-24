import { delay, HttpResponse } from 'msw'
import type { ApiErrorBody, ApiErrorCode, Role, User } from '@/api/types'
import { config } from '@/config'
import { findUserById } from './db'
import { verifyAccessToken } from './tokens'

/** Full URL of an API path, e.g. api('/auth/login'). Handlers follow VITE_API_URL. */
export const api = (path: string) => `${config.apiUrl}${path}`

const STATUS_TEXT: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  415: 'Unsupported Media Type',
  429: 'Too Many Requests',
}

/** Error response in the contract's shape. */
export function apiError(
  status: number,
  message: string,
  details?: ApiErrorBody['details'],
  headers?: HeadersInit,
): Response {
  return HttpResponse.json<ApiErrorBody>(
    { statusCode: status, error: STATUS_TEXT[status] ?? 'Error', message, details },
    { status, headers },
  )
}

/** Business error with a machine-readable `code` (contract v0.3). */
export function businessError(
  status: 403 | 409 | 422,
  code: ApiErrorCode,
  message: string,
  headers?: HeadersInit,
): Response {
  return HttpResponse.json<ApiErrorBody>(
    { statusCode: status, error: STATUS_TEXT[status] ?? 'Error', code, message },
    { status, headers },
  )
}

/** Small realistic latency in the browser; none in tests. */
export async function latency() {
  if (import.meta.env.MODE !== 'test') await delay(150 + Math.random() * 250)
}

type AuthResult = { user: User; error?: never } | { user?: never; error: Response }

/** Resolve the bearer token to an active user, optionally checking the role. */
export function authenticate(request: Request, roles?: readonly Role[]): AuthResult {
  const header = request.headers.get('Authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : ''
  const userId = token ? verifyAccessToken(token) : null
  const user = userId ? findUserById(userId) : undefined
  if (!user || user.status !== 'ACTIVE') return { error: apiError(401, 'Unauthorized') }
  if (roles && !roles.includes(user.role)) return { error: apiError(403, 'Forbidden resource') }
  return { user }
}

export async function readJson<T>(request: Request): Promise<Partial<T>> {
  try {
    return ((await request.json()) ?? {}) as Partial<T>
  } catch {
    return {}
  }
}
