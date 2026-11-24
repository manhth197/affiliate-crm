import {
  CommissionType,
  ProductCategory,
  Role,
} from '../src/generated/prisma/enums';
import {
  actor,
  type Actor,
  API,
  bearer,
  createProduct,
  createTestApp,
  resetDatabase,
  type TestContext,
} from './utils';

describe('Products (e2e)', () => {
  let ctx: TestContext;
  let admin: Actor;
  let staff: Actor;
  let affiliate: Actor;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.prisma);
    [admin, staff, affiliate] = await Promise.all([
      actor(ctx, Role.ADMIN),
      actor(ctx, Role.STAFF),
      actor(ctx, Role.AFFILIATE),
    ]);
    await createProduct(ctx, { name: 'A - Vay tín chấp' });
    await createProduct(ctx, {
      name: 'B - Thẻ tín dụng',
      category: ProductCategory.CREDIT_CARD,
      commissionType: CommissionType.FIXED,
      commissionValue: 500_000,
    });
    await createProduct(ctx, { name: 'C - Ngừng bán', active: false });
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  describe('GET /products', () => {
    it('shows affiliates active products only, even when asking for inactive ones', async () => {
      const res = await ctx
        .http()
        .get(`${API}/products?active=false`)
        .set(...bearer(affiliate))
        .expect(200);
      expect(res.body.map((p: { name: string }) => p.name)).toEqual([
        'A - Vay tín chấp',
        'B - Thẻ tín dụng',
      ]);
    });

    it('shows staff everything, sorted by name, with filters', async () => {
      const all = await ctx
        .http()
        .get(`${API}/products`)
        .set(...bearer(staff))
        .expect(200);
      expect(all.body).toHaveLength(3);
      expect(all.body[0]).toEqual({
        id: expect.any(String),
        name: 'A - Vay tín chấp',
        partnerName: 'FE Credit',
        category: 'LOAN',
        commissionType: 'PERCENT',
        commissionValue: 150,
        active: true,
        createdAt: expect.any(String),
      });

      const inactive = await ctx
        .http()
        .get(`${API}/products?active=false`)
        .set(...bearer(staff))
        .expect(200);
      expect(inactive.body.map((p: { name: string }) => p.name)).toEqual([
        'C - Ngừng bán',
      ]);

      const cards = await ctx
        .http()
        .get(`${API}/products?category=CREDIT_CARD`)
        .set(...bearer(staff))
        .expect(200);
      expect(cards.body).toHaveLength(1);
    });

    it('validates query values', async () => {
      await ctx
        .http()
        .get(`${API}/products?active=maybe`)
        .set(...bearer(staff))
        .expect(400);
      await ctx
        .http()
        .get(`${API}/products?category=CAR`)
        .set(...bearer(staff))
        .expect(400);
    });
  });

  describe('POST /products', () => {
    const body = {
      name: 'Bảo hiểm sức khoẻ',
      partnerName: 'Bảo Việt',
      category: 'INSURANCE',
      commissionType: 'PERCENT',
      commissionValue: 1000,
    };

    it('lets an admin create a product and writes an audit entry', async () => {
      const res = await ctx
        .http()
        .post(`${API}/products`)
        .set(...bearer(admin))
        .send(body)
        .expect(201);
      expect(res.body).toMatchObject({ ...body, active: true });

      const audit = await ctx.prisma.auditLog.findFirstOrThrow({
        where: { entityId: res.body.id, action: 'PRODUCT_CREATED' },
      });
      expect(audit.actorId).toBe(admin.id);
    });

    it.each([
      ['staff', () => staff],
      ['affiliate', () => affiliate],
    ])('refuses %s with 403', async (_label, who) => {
      await ctx
        .http()
        .post(`${API}/products`)
        .set(...bearer(who()))
        .send(body)
        .expect(403);
    });

    it('rejects a percentage above 100%', async () => {
      const res = await ctx
        .http()
        .post(`${API}/products`)
        .set(...bearer(admin))
        .send({ ...body, commissionValue: 20_000 })
        .expect(400);
      expect(res.body.details).toEqual([
        {
          field: 'commissionValue',
          message: 'must be at most 10000 basis points (100%) for PERCENT',
        },
      ]);
    });
  });

  describe('PATCH /products/:id', () => {
    it('validates the commission rule against the merged result', async () => {
      const product = await createProduct(ctx, {
        commissionType: CommissionType.FIXED,
        commissionValue: 300_000,
      });

      // Switching to PERCENT while keeping 300000 would mean 3000%.
      await ctx
        .http()
        .patch(`${API}/products/${product.id}`)
        .set(...bearer(admin))
        .send({ commissionType: 'PERCENT' })
        .expect(400);

      const res = await ctx
        .http()
        .patch(`${API}/products/${product.id}`)
        .set(...bearer(admin))
        .send({
          commissionType: 'PERCENT',
          commissionValue: 200,
          active: false,
        })
        .expect(200);
      expect(res.body).toMatchObject({
        commissionType: 'PERCENT',
        commissionValue: 200,
        active: false,
      });

      const audit = await ctx.prisma.auditLog.findFirstOrThrow({
        where: { entityId: product.id, action: 'PRODUCT_UPDATED' },
      });
      expect(audit.before).toMatchObject({ commissionType: 'FIXED' });
      expect(audit.after).toMatchObject({ commissionType: 'PERCENT' });
    });

    it('returns 404 for an unknown product and 400 for a malformed id', async () => {
      await ctx
        .http()
        .patch(`${API}/products/01a20b8d-6da3-73f4-8630-c05207776962`)
        .set(...bearer(admin))
        .send({ active: false })
        .expect(404);
      await ctx
        .http()
        .patch(`${API}/products/not-a-uuid`)
        .set(...bearer(admin))
        .send({ active: false })
        .expect(400);
    });
  });
});
