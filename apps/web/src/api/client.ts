import { config } from '@/config'
import { ApiError } from './errors'
import { tokenStore } from './token-store'
import type { TokenPair } from './types'

type QueryValue = string | number | boolean | null | undefined
export type Query = Record<string, QueryValue>

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  /** JSON body. A function is evaluated right before each attempt (used by logout). */
  body?: unknown
  query?: Query
  /** Send the bearer token and refresh it on 401. Default: true. */
  auth?: boolean
  /**
   * Send and accept cookies cross-origin (`credentials: "include"`). Only the auth endpoints
   * need it: they set and read the httpOnly refresh cookie (contract v0.6).
   */
  withCredentials?: boolean
  signal?: AbortSignal
}

export function buildUrl(path: string, query?: Query) {
  // The base may be relative to the page (same-origin deployment behind a reverse proxy).
  const url = new URL(config.apiUrl + path, globalThis.location?.origin)
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value))
    }
  }
  return url.toString()
}

// ---- Session expiry notifications ----
const expiryListeners = new Set<() => void>()

/** Called when the API rejects the refresh token, i.e. the user must log in again. */
export function onSessionExpired(listener: () => void) {
  expiryListeners.add(listener)
  return () => {
    expiryListeners.delete(listener)
  }
}

// ---- Token refresh ----
let refreshInFlight: Promise<string | null> | null = null

/**
 * Get a new access token with the httpOnly refresh cookie.
 * - Single-flight inside the tab: concurrent 401s share one refresh call.
 * - Serialized across tabs with the Web Locks API: the cookie is shared by all tabs and the
 *   token in it is single-use, so two parallel refreshes would make the second one fail (401).
 *   Inside the lock each refresh sends whatever cookie the previous one left.
 * Resolves to null when the session is over (no session, or the API rejected the cookie).
 */
export function refreshAccessToken(): Promise<string | null> {
  refreshInFlight ??= withRefreshLock(doRefresh).finally(() => {
    refreshInFlight = null
  })
  return refreshInFlight
}

function withRefreshLock<T>(fn: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request('affiliate-crm:auth-refresh', fn) as Promise<T>
  }
  return fn()
}

async function doRefresh(): Promise<string | null> {
  if (!tokenStore.hasSession()) return null

  // Cookie-only refresh: JSON content type + `{}` body (otherwise 415), credentials included.
  const response = await send(buildUrl('/auth/refresh'), 'POST', {}, null, undefined, true)
  if (response.ok) {
    const tokens = (await response.json()) as TokenPair
    tokenStore.setTokens(tokens)
    return tokens.accessToken
  }
  // The API also clears the cookie on 401/403.
  if (response.status === 400 || response.status === 401 || response.status === 403) {
    tokenStore.clear()
    expiryListeners.forEach((listener) => listener())
    return null
  }
  // 5xx / 429: keep the session, a later request can try again.
  throw await toApiError(response)
}

// ---- Requests ----
async function send(
  url: string,
  method: string,
  body: unknown,
  accessToken?: string | null,
  signal?: AbortSignal,
  withCredentials = false,
) {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  try {
    return await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
      // Same-origin requests send cookies anyway; cross-origin ones only with "include".
      credentials: withCredentials ? 'include' : 'same-origin',
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError(0, { message: 'Network error' })
  }
}

async function toApiError(response: Response) {
  try {
    return new ApiError(response.status, await response.json())
  } catch {
    return new ApiError(response.status)
  }
}

async function parse<T>(response: Response): Promise<T> {
  if (!response.ok) throw await toApiError(response)
  if (response.status === 204) return undefined as T
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) return (await response.json()) as T
  return (await response.text()) as T
}

/** Typed fetch wrapper for the CRM API: base URL, JSON, bearer token, refresh-and-retry on 401. */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', query, auth = true, withCredentials = false, signal } = options
  const url = buildUrl(path, query)
  const body = () => (typeof options.body === 'function' ? options.body() : options.body)
  const sendWith = (token: string | null) =>
    send(url, method, body(), token, signal, withCredentials)

  if (!auth) return parse<T>(await sendWith(null))

  let token = tokenStore.getAccessToken()
  // After a page reload only the refresh cookie is left: get an access token first.
  if (!token && tokenStore.hasSession()) token = await refreshAccessToken()

  let response = await sendWith(token)
  if (response.status === 401 && tokenStore.hasSession()) {
    // Another request may already have refreshed while this one was in flight.
    const current = tokenStore.getAccessToken()
    const next = current && current !== token ? current : await refreshAccessToken()
    if (next) response = await sendWith(next)
  }
  return parse<T>(response)
}
