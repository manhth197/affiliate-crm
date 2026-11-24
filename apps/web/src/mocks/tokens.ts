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
  return { accessToken: createAccessToken(userId, now), refreshToken }
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
