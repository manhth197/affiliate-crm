import type { Response } from 'supertest';
import {
  API,
  createTestApp,
  PASSWORD,
  refreshCookie,
  refreshWith,
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

function isCleared(res: Response): boolean {
  const line = refreshSetCookie(res) ?? '';
  return line.startsWith('crm_rt=;') && /Expires=Thu, 01 Jan 1970/.test(line);
}

describe('Refresh token cookie, contract v0.7 (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.prisma);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  function register() {
    return ctx
      .http()
      .post(`${API}/auth/register`)
      .send({
        email: uniqueEmail('cookie'),
        password: PASSWORD,
        fullName: 'Cookie Test',
        phone: '0912345678',
      })
      .expect(201);
  }

  it('login and register set an httpOnly, SameSite=Strict cookie scoped to /api/v1/auth, never a body token', async () => {
    const registered = await register();
    const line = refreshSetCookie(registered)!;
    expect(line).toMatch(/^crm_rt=[A-Za-z0-9_-]{43};/);
    expect(line).toContain('HttpOnly');
    expect(line).toContain('SameSite=Strict');
    expect(line).toContain('Path=/api/v1/auth');
    expect(line).toContain('Max-Age=604800');
    expect(line).not.toContain('Secure'); // COOKIE_SECURE=false in tests
    expect(registered.body).not.toHaveProperty('refreshToken');

    const login = await ctx
      .http()
      .post(`${API}/auth/login`)
      .send({ email: registered.body.user.email, password: PASSWORD })
      .expect(200);
    expect(refreshCookie(login)).toMatch(/^crm_rt=/);
    expect(refreshCookie(login)).not.toBe(refreshCookie(registered));
    expect(login.body).not.toHaveProperty('refreshToken');
  });

  it('refreshes with the cookie and rotates it', async () => {
    const first = refreshCookie(await register());

    const res = await refreshWith(ctx, first).expect(200);
    expect(res.body).toEqual({
      accessToken: expect.any(String),
      expiresIn: 900,
    });
    const second = refreshCookie(res);
    expect(second).not.toBe(first);

    // Works with no body at all, too.
    const third = await ctx
      .http()
      .post(`${API}/auth/refresh`)
      .set('Cookie', second)
      .set('Content-Type', 'application/json')
      .expect(200);
    expect(refreshCookie(third)).not.toBe(second);
  });

  it('revokes the whole family when an old cookie is replayed, and clears the cookie', async () => {
    const first = refreshCookie(await register());
    const second = refreshCookie(await refreshWith(ctx, first).expect(200));

    const replay = await refreshWith(ctx, first).expect(401);
    expect(replay.body.message).toBe('Refresh token has been revoked');
    expect(isCleared(replay)).toBe(true);

    await refreshWith(ctx, second).expect(401);
  });

  it('rejects a refreshToken in the body with 400 (old clients), even with a valid cookie', async () => {
    const cookie = refreshCookie(await register());
    const res = await ctx
      .http()
      .post(`${API}/auth/refresh`)
      .set('Cookie', cookie)
      .send({ refreshToken: 'anything' })
      .expect(400);
    expect(res.body.details[0].field).toBe('refreshToken');
    // Nothing was consumed.
    await refreshWith(ctx, cookie).expect(200);
  });

  it('refuses a cookie call that is not JSON (would skip the CORS preflight) without using the token', async () => {
    const cookie = refreshCookie(await register());
    await ctx
      .http()
      .post(`${API}/auth/refresh`)
      .set('Cookie', cookie)
      .set('Content-Type', 'text/plain')
      .send('x')
      .expect(415);
    await refreshWith(ctx, cookie).expect(200);
  });

  it('logout revokes the cookie token and clears the cookie', async () => {
    const registered = await register();
    const cookie = refreshCookie(registered);

    const res = await ctx
      .http()
      .post(`${API}/auth/logout`)
      .set('Authorization', `Bearer ${registered.body.accessToken}`)
      .set('Cookie', cookie)
      .set('Content-Type', 'application/json')
      .send({})
      .expect(204);
    expect(isCleared(res)).toBe(true);

    await refreshWith(ctx, cookie).expect(401);
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
