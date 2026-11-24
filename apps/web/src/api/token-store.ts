import type { TokenPair } from './types'

/**
 * Where the tokens live (see docs/decisions/001-web-auth-token-storage.md):
 * - access token: module memory only (gone on reload, never written to storage);
 * - refresh token: localStorage, so the session survives reloads and new tabs.
 */
export const REFRESH_TOKEN_KEY = 'affiliate-crm.refreshToken'

let accessToken: string | null = null
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
  getAccessToken: () => accessToken,
  getRefreshToken: readRefreshToken,
  hasSession: () => readRefreshToken() !== null,

  setTokens(tokens: TokenPair) {
    accessToken = tokens.accessToken
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
