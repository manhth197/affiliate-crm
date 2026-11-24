import type { Response } from 'supertest';
import {
  API,
  createTestApp,
  PASSWORD,
  resetDatabase,
  type TestContext,
  uniqueEmail,
} from './utils';

const WEB_ORIGIN = 'http://localhost:5173';

/** The raw Set-Cookie line for crm_rt, if the response set one. */
function refreshSetCookie(res: Response): string | undefined {
  const header = res.headers['set-cookie'] as unknown as string[] | undefined;
  return header?.find((line) => line.startsWith('crm_rt='));
}

/** "crm_rt=<value>" — what the browser sends back. */
function cookiePair(res: Response): string {
  const line = refreshSetCookie(res);
  if (!line) throw new Error('no crm_rt cookie in response');
  return line.split(';')[0];
}

function isCleared(res: Response): boolean {
  const line = refreshSetCookie(res) ?? '';
  return line.startsWith('crm_rt=;') && /Expires=Thu, 01 Jan 1970/.test(line);
}

describe('Refresh token cookie, contract v0.6 (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.prisma);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  async function register() {
    const res = await ctx
      .http()
      .post(`${API}/auth/register`)
      .send({
        email: uniqueEmail('cookie'),
        password: PASSWORD,
        fullName: 'Cookie Test',
        phone: '0912345678',
      })
      .expect(201);
    return res;
  }

  /** Browser-style refresh: no body token, cookie + JSON content type. */
  function refreshWithCookie(cookie: string) {
    return ctx
      .http()
      .post(`${API}/auth/refresh`)
      .set('Cookie', cookie)
      .set('Content-Type', 'application/json')
      .send({});
  }

  it('login and register set an httpOnly, SameSite=Strict cookie scoped to /api/v1/auth', async () => {
    const registered = await register();
    const line = refreshSetCookie(registered)!;
    expect(line).toBeDefined();
    expect(line.split(';')[0]).toBe(`crm_rt=${registered.body.refreshToken}`);
    expect(line).toContain('HttpOnly');
    expect(line).toContain('SameSite=Strict');
    expect(line).toContain('Path=/api/v1/auth');
    expect(line).toContain('Max-Age=604800');
    expect(line).not.toContain('Secure'); // COOKIE_SECURE=false in tests

    const login = await ctx
      .http()
      .post(`${API}/auth/login`)
      .send({ email: registered.body.user.email, password: PASSWORD })
      .expect(200);
    expect(cookiePair(login)).toBe(`crm_rt=${login.body.refreshToken}`);
  });

  it('refreshes with the cookie only and rotates it', async () => {
    const first = cookiePair(await register());

    const res = await refreshWithCookie(first).expect(200);
    const second = cookiePair(res);
    expect(second).not.toBe(first);
    // Body still carries the tokens during the transition (deprecated).
    expect(second).toBe(`crm_rt=${res.body.refreshToken}`);
    expect(res.body).toEqual({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
      expiresIn: 900,
    });

    // Works with no body at all, too.
    const third = await ctx
      .http()
      .post(`${API}/auth/refresh`)
      .set('Cookie', second)
      .set('Content-Type', 'application/json')
      .expect(200);
    expect(cookiePair(third)).not.toBe(second);
  });

  it('revokes the whole family when an old cookie is replayed, and clears the cookie', async () => {
    const first = cookiePair(await register());
    const second = cookiePair(await refreshWithCookie(first).expect(200));

    const replay = await refreshWithCookie(first).expect(401);
    expect(replay.body.message).toBe('Refresh token has been revoked');
    expect(isCleared(replay)).toBe(true);

    await refreshWithCookie(second).expect(401);
  });

  it('still supports the old body flow (deprecated)', async () => {
    const registered = await register();
    const res = await ctx
      .http()
      .post(`${API}/auth/refresh`)
      .send({ refreshToken: registered.body.refreshToken })
      .expect(200);
    expect(cookiePair(res)).toBe(`crm_rt=${res.body.refreshToken}`);
  });

  it('prefers the body token over the cookie', async () => {
    const registered = await register();
    await ctx
      .http()
      .post(`${API}/auth/refresh`)
      .set('Cookie', 'crm_rt=garbage')
      .send({ refreshToken: registered.body.refreshToken })
      .expect(200);
  });

  it('401s without any refresh token', async () => {
    const res = await ctx
      .http()
      .post(`${API}/auth/refresh`)
      .set('Content-Type', 'application/json')
      .send({})
      .expect(401);
    expect(res.body.message).toBe('Missing refresh token');
  });

  it('refuses a cookie call that is not JSON (would skip the CORS preflight) without using the token', async () => {
    const cookie = cookiePair(await register());
    await ctx
      .http()
      .post(`${API}/auth/refresh`)
      .set('Cookie', cookie)
      .set('Content-Type', 'text/plain')
      .send('x')
      .expect(415);
    // The token was not consumed.
    await refreshWithCookie(cookie).expect(200);
  });

  it('logout revokes the cookie token and clears the cookie', async () => {
    const registered = await register();
    const cookie = cookiePair(registered);

    const res = await ctx
      .http()
      .post(`${API}/auth/logout`)
      .set('Authorization', `Bearer ${registered.body.accessToken}`)
      .set('Cookie', cookie)
      .set('Content-Type', 'application/json')
      .expect(204);
    expect(isCleared(res)).toBe(true);

    await refreshWithCookie(cookie).expect(401);
  });

  it('allows credentialed CORS only for the web origin', async () => {
    const allowed = await ctx
      .http()
      .options(`${API}/auth/refresh`)
      .set('Origin', WEB_ORIGIN)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type')
      .expect(204);
    expect(allowed.headers['access-control-allow-origin']).toBe(WEB_ORIGIN);
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');

    const other = await ctx
      .http()
      .options(`${API}/auth/refresh`)
      .set('Origin', 'https://evil.example.com')
      .set('Access-Control-Request-Method', 'POST');
    expect(other.headers['access-control-allow-origin']).toBeUndefined();
  });
});
