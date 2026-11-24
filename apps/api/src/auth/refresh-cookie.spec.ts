import type { Request } from 'express';
import {
  isJsonRequest,
  REFRESH_COOKIE,
  refreshCookieOptions,
  resolveRefreshToken,
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

  it('prefers the body token, then the cookie', () => {
    const req = request({ [REFRESH_COOKIE]: 'from-cookie' });
    expect(resolveRefreshToken('from-body', req)).toEqual({
      token: 'from-body',
      fromCookie: false,
    });
    expect(resolveRefreshToken(undefined, req)).toEqual({
      token: 'from-cookie',
      fromCookie: true,
    });
  });

  it('returns no token when neither is present', () => {
    expect(
      resolveRefreshToken(undefined, request(undefined)).token,
    ).toBeUndefined();
    expect(
      resolveRefreshToken(undefined, request({ [REFRESH_COOKIE]: '' })).token,
    ).toBeUndefined();
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
