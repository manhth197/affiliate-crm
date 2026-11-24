import type { CookieOptions, Request } from 'express';
import { API_PREFIX } from '../app.setup';

/**
 * Refresh token transport (contract v0.7): the refresh token travels only in
 * an httpOnly cookie, so page JavaScript (and therefore XSS) cannot read it.
 */
export const REFRESH_COOKIE = 'crm_rt';
/** The browser only sends the cookie to the auth routes, never to the rest of the API. */
export const REFRESH_COOKIE_PATH = `/${API_PREFIX}/auth`;

const DAY_MS = 24 * 60 * 60 * 1000;

export function refreshCookieOptions(
  secure: boolean,
  ttlDays: number,
): CookieOptions {
  return {
    httpOnly: true,
    // Never sent on cross-site requests: a forged form or <img> from another
    // site cannot use the session (CSRF).
    sameSite: 'strict',
    path: REFRESH_COOKIE_PATH,
    secure,
    maxAge: ttlDays * DAY_MS,
  };
}

/** The refresh token from the crm_rt cookie (the only transport since v0.7). */
export function readRefreshCookie(request: Request): string | undefined {
  const cookies = request.cookies as Record<string, unknown> | undefined;
  const cookie = cookies?.[REFRESH_COOKIE];
  return typeof cookie === 'string' && cookie !== '' ? cookie : undefined;
}

/**
 * A cookie-authenticated call must be `Content-Type: application/json`. That
 * header makes any cross-origin request a CORS preflight, which the server
 * only allows for the configured web origins.
 */
export function isJsonRequest(request: Request): boolean {
  return /^application\/json\b/i.test(request.headers['content-type'] ?? '');
}
