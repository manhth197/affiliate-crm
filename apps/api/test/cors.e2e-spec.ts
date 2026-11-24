import { Role } from '../src/generated/prisma/enums';
import {
  actor,
  type Actor,
  API,
  bearer,
  createProduct,
  createTestApp,
  resetDatabase,
  submitLead,
  type TestContext,
} from './utils';

const WEB_ORIGIN = 'http://localhost:5173';

describe('CORS for the web app (e2e)', () => {
  let ctx: TestContext;
  let staff: Actor;
  let leadId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.prisma);
    staff = await actor(ctx, Role.STAFF);
    const affiliate = await actor(ctx, Role.AFFILIATE);
    const product = await createProduct(ctx);
    leadId = (await submitLead(ctx, affiliate, product.id)).id;
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('answers the preflight for PATCH with Authorization and Content-Type', async () => {
    const res = await ctx
      .http()
      .options(`${API}/leads/${leadId}/status`)
      .set('Origin', WEB_ORIGIN)
      .set('Access-Control-Request-Method', 'PATCH')
      .set('Access-Control-Request-Headers', 'authorization,content-type')
      .expect(204);

    expect(res.headers['access-control-allow-origin']).toBe(WEB_ORIGIN);
    const methods = res.headers['access-control-allow-methods'].split(',');
    expect(methods).toEqual(
      expect.arrayContaining(['GET', 'POST', 'PATCH', 'DELETE']),
    );
    const headers = res.headers['access-control-allow-headers']
      .toLowerCase()
      .split(',');
    expect(headers).toEqual(
      expect.arrayContaining(['authorization', 'content-type']),
    );
    expect(res.headers['access-control-max-age']).toBe('600');
  });

  it('allows the actual PATCH from the web origin', async () => {
    const res = await ctx
      .http()
      .patch(`${API}/leads/${leadId}/status`)
      .set('Origin', WEB_ORIGIN)
      .set(...bearer(staff))
      .send({ status: 'CONTACTED' })
      .expect(200);
    expect(res.headers['access-control-allow-origin']).toBe(WEB_ORIGIN);
    expect(res.headers['access-control-expose-headers']).toBe(
      'Content-Disposition',
    );
  });

  it('does not grant other origins', async () => {
    const res = await ctx
      .http()
      .options(`${API}/leads`)
      .set('Origin', 'https://evil.example.com')
      .set('Access-Control-Request-Method', 'GET');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
