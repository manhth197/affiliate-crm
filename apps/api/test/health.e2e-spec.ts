import { API, createTestApp, type TestContext } from './utils';

describe('Health (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('GET /health reports DB and Redis up, without a token', async () => {
    const res = await ctx.http().get(`${API}/health`).expect(200);
    expect(res.body).toEqual({ status: 'ok', db: 'up', redis: 'up' });
  });

  it('unknown routes return 404 in the standard error format', async () => {
    const res = await ctx.http().get(`${API}/does-not-exist`).expect(404);
    expect(res.body).toEqual({
      statusCode: 404,
      error: 'Not Found',
      message: `Cannot GET ${API}/does-not-exist`,
    });
  });
});
