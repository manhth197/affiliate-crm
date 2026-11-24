import { getOptionsToken } from '@nestjs/throttler';
import { API, createTestApp, resetDatabase, type TestContext } from './utils';

describe('Auth rate limiting (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp((builder) =>
      builder.overrideProvider(getOptionsToken()).useValue({
        throttlers: [{ ttl: 60_000, limit: 3 }],
        errorMessage: 'Too many requests, please try again later',
      }),
    );
    await resetDatabase(ctx.prisma);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('returns 429 in the standard error format after the limit', async () => {
    const attempt = () =>
      ctx
        .http()
        .post(`${API}/auth/login`)
        .send({ email: 'someone@example.com', password: 'Wrong@12345' });

    for (let i = 0; i < 3; i++) {
      await attempt().expect(401);
    }
    const res = await attempt().expect(429);
    expect(res.body).toEqual({
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Too many requests, please try again later',
    });
    expect(res.headers['retry-after']).toBeDefined();
  });

  it('does not throttle routes outside /auth', async () => {
    for (let i = 0; i < 5; i++) {
      await ctx.http().get(`${API}/health`).expect(200);
    }
  });

  it('behind a proxy (TRUST_PROXY=1) limits each client IP from X-Forwarded-For separately', async () => {
    const attemptFrom = (ip: string) =>
      ctx
        .http()
        .post(`${API}/auth/login`)
        .set('X-Forwarded-For', ip)
        .send({ email: 'someone@example.com', password: 'Wrong@12345' });

    // Four different users behind the same proxy: nobody is throttled.
    for (const ip of [
      '198.51.100.1',
      '198.51.100.2',
      '198.51.100.3',
      '198.51.100.4',
    ]) {
      await attemptFrom(ip).expect(401);
    }
    // One user hammering: throttled after the limit (3).
    for (let i = 0; i < 3; i++) {
      await attemptFrom('203.0.113.9').expect(401);
    }
    await attemptFrom('203.0.113.9').expect(429);
  });
});
