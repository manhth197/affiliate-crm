import type { Request } from 'express';
import {
  isJsonRequest,
  REFRESH_COOKIE,
  refreshCookieOptions,
  readRefreshCookie,
} from './refresh-cookie';

function request(
  cookies: Record<string, string> | undefined,
  contentType?: string,
): Request {
  return {
    cookies,
    headers: contentType ? { 'content-type': contentType } : {},
  } as unknown as Request;
}

describe('refresh cookie', () => {
  it('is httpOnly, SameSite=Strict, scoped to /api/v1/auth, 7 days', () => {
    expect(refreshCookieOptions(false, 7)).toEqual({
      httpOnly: true,
      sameSite: 'strict',
      path: '/api/v1/auth',
      secure: false,
      maxAge: 604_800_000,
    });
    expect(refreshCookieOptions(true, 7).secure).toBe(true);
  });

  it('reads the token from the crm_rt cookie only', () => {
    expect(
      readRefreshCookie(request({ [REFRESH_COOKIE]: 'from-cookie' })),
    ).toBe('from-cookie');
    expect(readRefreshCookie(request(undefined))).toBeUndefined();
    expect(
      readRefreshCookie(request({ [REFRESH_COOKIE]: '' })),
    ).toBeUndefined();
    expect(readRefreshCookie(request({ other: 'x' }))).toBeUndefined();
  });

  it.each([
    ['application/json', true],
    ['application/json; charset=utf-8', true],
    ['APPLICATION/JSON', true],
    ['text/plain', false],
    ['application/x-www-form-urlencoded', false],
    ['application/jsonx', false],
    [undefined, false],
  ])('content-type %p is JSON: %p', (contentType, expected) => {
    expect(isJsonRequest(request(undefined, contentType))).toBe(expected);
  });
});
