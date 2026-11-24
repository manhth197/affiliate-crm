import type { TokenPair } from './types'

/**
 * Where the tokens live (contract v0.6, see docs/decisions/001-web-auth-token-storage.md):
 * - access token: module memory only (gone on reload, never written to storage);
 * - refresh token: an httpOnly cookie set by the API (`crm_rt`, Path=/api/v1/auth). JavaScript
 *   never sees it; the API client calls /auth/refresh with `credentials: "include"`.
 * - localStorage keeps only a non-secret hint that a session probably exists, so a guest does
 *   not trigger a pointless refresh on every page load, and other tabs learn about log in/out.
 */
export const SESSION_HINT_KEY = 'affiliate-crm.session'
/** Where versions before v0.6 kept the refresh token itself; removed on load. */
export const LEGACY_REFRESH_TOKEN_KEY = 'affiliate-crm.refreshToken'

/** Treat the access token as expired this long before it really expires (slow networks). */
export const EXPIRY_MARGIN_MS = 30_000

let accessToken: string | null = null
/** When the access token stops being usable (from the API's `expiresIn`). */
let accessTokenExpiresAt = 0
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((listener) => listener())
}

function storage(): Storage | null {
  try {
    return localStorage
  } catch {
    return null // storage disabled (privacy mode): sessions end on reload
  }
}

/** Upgrade from the localStorage-token versions: never leave a refresh token readable by JS. */
export function removeLegacyRefreshToken() {
  storage()?.removeItem(LEGACY_REFRESH_TOKEN_KEY)
}
removeLegacyRefreshToken()

export const tokenStore = {
  /**
   * The access token, or null if there is none or it is about to expire; the API client then
   * refreshes first instead of sending a request that would come back 401.
   */
  getAccessToken: () =>
    accessToken && Date.now() < accessTokenExpiresAt - EXPIRY_MARGIN_MS ? accessToken : null,

  /** Whether a refresh cookie probably exists (the cookie itself is invisible to JS). */
  hasSession: () => storage()?.getItem(SESSION_HINT_KEY) === '1',

  /** After login/register/refresh. The body's `refreshToken` (deprecated) is ignored. */
  setTokens(tokens: Pick<TokenPair, 'accessToken' | 'expiresIn'>) {
    accessToken = tokens.accessToken
    // Fall back to the documented 15 minutes if an older API omits `expiresIn`.
    const lifetimeSeconds = Number.isFinite(tokens.expiresIn) ? tokens.expiresIn : 900
    accessTokenExpiresAt = Date.now() + lifetimeSeconds * 1000
    try {
      storage()?.setItem(SESSION_HINT_KEY, '1')
    } catch {
      // Quota or privacy mode: the session just will not survive a reload.
    }
    emit()
  },

  clear() {
    accessToken = null
    storage()?.removeItem(SESSION_HINT_KEY)
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

// Another tab logged in or out (it changed the hint): keep this tab in sync.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== SESSION_HINT_KEY && event.key !== null) return
    if (event.newValue === null) accessToken = null
    emit()
  })
}
