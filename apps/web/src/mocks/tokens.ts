import type { TokenPair } from '@/api/types'
import { db, findUserById } from './db'

/** Same lifetimes as the real API (ARCHITECTURE.md): access 15 min, refresh 7 days. */
export const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000

const ACCESS_PREFIX = 'mock-access'

/**
 * Mock access tokens are readable strings `mock-access.<userId>.<expiresAt>` — not JWTs.
 * The web app treats tokens as opaque, so the format does not matter to it.
 */
export function createAccessToken(userId: string, now = Date.now()): string {
  return `${ACCESS_PREFIX}.${userId}.${now + ACCESS_TOKEN_TTL_MS}`
}

/** Returns the user id, or null if the token is malformed or expired. */
export function verifyAccessToken(token: string, now = Date.now()): string | null {
  const [prefix, userId, expiresAt] = token.split('.')
  if (prefix !== ACCESS_PREFIX || !userId || !expiresAt) return null
  if (Number(expiresAt) <= now) return null
  return userId
}

export function issueTokens(userId: string, now = Date.now()): TokenPair {
  const refreshToken = `mock-refresh.${crypto.randomUUID()}`
  db.sessions[refreshToken] = { userId, expiresAt: now + REFRESH_TOKEN_TTL_MS }
  return {
    accessToken: createAccessToken(userId, now),
    refreshToken,
    expiresIn: ACCESS_TOKEN_TTL_MS / 1000,
  }
}

/**
 * Single use: the old refresh token is deleted and a new pair is returned.
 * Null if the token is unknown, expired, or its user was disabled.
 */
export function rotateRefreshToken(refreshToken: string, now = Date.now()): TokenPair | null {
  const session = db.sessions[refreshToken]
  if (!session) return null
  delete db.sessions[refreshToken]
  if (session.expiresAt <= now) return null
  if (findUserById(session.userId)?.status !== 'ACTIVE') return null
  return issueTokens(session.userId, now)
}

export function revokeRefreshToken(refreshToken: string) {
  delete db.sessions[refreshToken]
}

// ---- The refresh cookie (contract v0.6) ----
const COOKIE_NAME = 'crm_rt'
const COOKIE_ATTRIBUTES = 'Path=/api/v1/auth; HttpOnly; SameSite=Strict; Max-Age=604800'

/** Whether the browser would attach cookies to this request. */
function sendsCookies(request: Request) {
  if (request.credentials === 'include') return true
  return (
    request.credentials === 'same-origin' &&
    typeof location !== 'undefined' &&
    new URL(request.url).origin === location.origin
  )
}

export function readRefreshCookie(request: Request): string | null {
  return sendsCookies(request) ? db.refreshCookie : null
}

/** Store the cookie (if the browser would accept it) and return the Set-Cookie header. */
export function setRefreshCookie(request: Request, refreshToken: string): HeadersInit {
  if (sendsCookies(request)) db.refreshCookie = refreshToken
  return { 'Set-Cookie': `${COOKIE_NAME}=${refreshToken}; ${COOKIE_ATTRIBUTES}` }
}

export function clearRefreshCookie(): HeadersInit {
  db.refreshCookie = null
  return {
    'Set-Cookie': `${COOKIE_NAME}=; Path=/api/v1/auth; HttpOnly; SameSite=Strict; Max-Age=0`,
  }
}

/** Tests: a logged-in browser for this user (session + cookie), skipping the login form. */
export function startMockSession(userId: string): TokenPair {
  const tokens = issueTokens(userId)
  db.refreshCookie = tokens.refreshToken
  return tokens
}
