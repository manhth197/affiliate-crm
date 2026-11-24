import type { TokenPair } from './types'

/**
 * Where the tokens live (see docs/decisions/001-web-auth-token-storage.md):
 * - access token: module memory only (gone on reload, never written to storage);
 * - refresh token: localStorage, so the session survives reloads and new tabs.
 */
export const REFRESH_TOKEN_KEY = 'affiliate-crm.refreshToken'

/** Treat the access token as expired this long before it really expires (slow networks). */
export const EXPIRY_MARGIN_MS = 30_000

let accessToken: string | null = null
/** When the access token stops being usable (from the API's `expiresIn`). */
let accessTokenExpiresAt = 0
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((listener) => listener())
}

function readRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY)
  } catch {
    return null // storage disabled (privacy mode): behave as logged out
  }
}

export const tokenStore = {
  /**
   * The access token, or null if there is none or it is about to expire; the API client then
   * refreshes first instead of sending a request that would come back 401.
   */
  getAccessToken: () =>
    accessToken && Date.now() < accessTokenExpiresAt - EXPIRY_MARGIN_MS ? accessToken : null,
  getRefreshToken: readRefreshToken,
  hasSession: () => readRefreshToken() !== null,

  setTokens(tokens: TokenPair) {
    accessToken = tokens.accessToken
    // Fall back to the documented 15 minutes if an older API omits `expiresIn`.
    const lifetimeSeconds = Number.isFinite(tokens.expiresIn) ? tokens.expiresIn : 900
    accessTokenExpiresAt = Date.now() + lifetimeSeconds * 1000
    try {
      localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken)
    } catch {
      // Without storage the session simply ends on reload.
    }
    emit()
  },

  clear() {
    accessToken = null
    try {
      localStorage.removeItem(REFRESH_TOKEN_KEY)
    } catch {
      // ignore
    }
    emit()
  },

  /** Subscribe to token changes (compatible with React's useSyncExternalStore). */
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
}

// Another tab logged in or out: keep this tab in sync.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== REFRESH_TOKEN_KEY && event.key !== null) return
    if (event.newValue === null) accessToken = null
    emit()
  })
}
