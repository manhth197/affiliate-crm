import { CommissionsService } from '../src/commissions/commissions.service';
import { vnMonth } from '../src/common/dates';
import {
  CommissionType,
  LeadStatus,
  ProductCategory,
  Role,
} from '../src/generated/prisma/enums';
import {
  actor,
  type Actor,
  advanceLead,
  API,
  bearer,
  createProduct,
  createTestApp,
  nextCustomerPhone,
  resetDatabase,
  submitLead,
  type TestContext,
  waitFor,
} from './utils';

describe('Commissions (e2e, BullMQ worker + real DB)', () => {
  let ctx: TestContext;
  let commissions: CommissionsService;
  let admin: Actor;
  let staff: Actor;
  let ctv1: Actor;
  let ctv2: Actor;
  let percentProduct: { id: string };
  let fixedProduct: { id: string };

  const commissionOf = (leadId: string) =>
    ctx.prisma.commission.findUnique({ where: { leadId } });

  /** A DISBURSED lead inserted directly: no event, so no job is queued. */
  async function silentDisbursedLead(affiliateId: string, amount: bigint) {
    return ctx.prisma.lead.create({
      data: {
        affiliateId,
        productId: percentProduct.id,
        customerName: 'Khách Im Lặng',
        customerNameSearch: 'khach im lang',
        customerPhone: nextCustomerPhone(),
        status: LeadStatus.DISBURSED,
        disbursedAmount: amount,
      },
    });
  }

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.prisma);
    commissions = ctx.app.get(CommissionsService);
    admin = await actor(ctx, Role.ADMIN);
    staff = await actor(ctx, Role.STAFF);
    ctv1 = await actor(ctx, Role.AFFILIATE, 'Nguyễn Văn An');
    ctv2 = await actor(ctx, Role.AFFILIATE, 'Trần Thị Bình');
    percentProduct = await createProduct(ctx, { commissionValue: 150 }); // 1.5%
    fixedProduct = await createProduct(ctx, {
      name: 'Thẻ tín dụng',
      category: ProductCategory.CREDIT_CARD,
      commissionType: CommissionType.FIXED,
      commissionValue: 500_000,
    });
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  describe('commission job', () => {
    it('creates a PENDING commission when a lead is disbursed, then notifies the affiliate', async () => {
      const lead = await submitLead(ctx, ctv1, percentProduct.id, {
        requestedAmount: 60_000_000,
      });
      await advanceLead(ctx, staff, lead.id, 'DISBURSED', 50_000_000);

      const commission = await waitFor(() => commissionOf(lead.id));
      expect(commission).toMatchObject({
        affiliateId: ctv1.id,
        amount: 750_000n, // 1.5% of 50,000,000
        status: 'PENDING',
        payoutId: null,
      });

      const notification = await waitFor(() =>
        ctx.prisma.notification.findFirst({
          where: { userId: ctv1.id, type: 'COMMISSION_CREATED' },
        }),
      );
      expect(notification.title).toBe('Hoa hồng mới: 750.000 ₫');
      expect(notification.data).toMatchObject({
        commissionId: commission.id,
        leadId: lead.id,
        leadCode: lead.code,
        amount: '750000',
      });
    });

    it('uses the fixed amount for FIXED products', async () => {
      const lead = await submitLead(ctx, ctv2, fixedProduct.id);
      await advanceLead(ctx, staff, lead.id, 'DISBURSED', 0);
      const commission = await waitFor(() => commissionOf(lead.id));
      expect(commission.amount).toBe(500_000n);
    });

    it('is idempotent: re-running the job, even concurrently, keeps one commission', async () => {
      const lead = await silentDisbursedLead(ctv1.id, 10_000_000n);

      const results = await Promise.all([
        commissions.createForLead(lead.id),
        commissions.createForLead(lead.id),
        commissions.createForLead(lead.id),
      ]);
      expect(results.filter((r) => r === 'created')).toHaveLength(1);
      expect(results.filter((r) => r === 'exists')).toHaveLength(2);
      await expect(commissions.createForLead(lead.id)).resolves.toBe('exists');
      expect(
        await ctx.prisma.commission.count({ where: { leadId: lead.id } }),
      ).toBe(1);
    });

    it('skips leads that are not disbursed', async () => {
      const lead = await submitLead(ctx, ctv1, percentProduct.id);
      await expect(commissions.createForLead(lead.id)).resolves.toBe('skipped');
      expect(await commissionOf(lead.id)).toBeNull();
    });

    it('reconcile finds disbursed leads whose job was lost and queues them', async () => {
      const lost = await silentDisbursedLead(ctv2.id, 20_000_000n);
      expect(await commissionOf(lost.id)).toBeNull();

      await expect(commissions.reconcile()).resolves.toBeGreaterThanOrEqual(1);

      const commission = await waitFor(() => commissionOf(lost.id));
      expect(commission.amount).toBe(300_000n);
    });
  });

  describe('GET /commissions and /commissions/summary', () => {
    it('shows affiliates only their own commissions', async () => {
      const res = await ctx
        .http()
        .get(`${API}/commissions?affiliateId=${ctv2.id}&pageSize=100`)
        .set(...bearer(ctv1))
        .expect(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      for (const c of res.body.data) {
        expect(c.affiliate).toEqual({ id: ctv1.id, fullName: 'Nguyễn Văn An' });
      }
      expect(res.body.data[0]).toEqual({
        id: expect.any(String),
        lead: {
          id: expect.any(String),
          code: expect.stringMatching(/^LD-\d{6}$/),
          customerName: expect.any(String),
        },
        affiliate: { id: ctv1.id, fullName: 'Nguyễn Văn An' },
        amount: expect.any(Number),
        status: expect.any(String),
        payoutId: null,
        createdAt: expect.any(String),
      });
    });

    it('lets staff filter by affiliate, status and Vietnam-calendar month', async () => {
      const total = await ctx.prisma.commission.count();
      const all = await ctx
        .http()
        .get(`${API}/commissions?month=${vnMonth(new Date())}`)
        .set(...bearer(staff))
        .expect(200);
      expect(all.body.meta.total).toBe(total);

      const old = await ctx
        .http()
        .get(`${API}/commissions?month=2000-01`)
        .set(...bearer(staff))
        .expect(200);
      expect(old.body.meta.total).toBe(0);

      const pendingOfCtv2 = await ctx
        .http()
        .get(`${API}/commissions?affiliateId=${ctv2.id}&status=PENDING`)
        .set(...bearer(staff))
        .expect(200);
      expect(
        pendingOfCtv2.body.data.every(
          (c: { affiliate: { id: string }; status: string }) =>
            c.affiliate.id === ctv2.id && c.status === 'PENDING',
        ),
      ).toBe(true);

      await ctx
        .http()
        .get(`${API}/commissions?month=2026-13`)
        .set(...bearer(staff))
        .expect(400);
    });

    it('summarises amounts by status and lead counts for the affiliate', async () => {
      const res = await ctx
        .http()
        .get(`${API}/commissions/summary`)
        .set(...bearer(ctv1))
        .expect(200);
      const pending = await ctx.prisma.commission.aggregate({
        where: { affiliateId: ctv1.id, status: 'PENDING' },
        _sum: { amount: true },
      });
      expect(res.body).toEqual({
        pending: Number(pending._sum.amount),
        approved: 0,
        paid: 0,
        totalLeads: await ctx.prisma.lead.count({
          where: { affiliateId: ctv1.id },
        }),
        disbursedLeads: await ctx.prisma.lead.count({
          where: { affiliateId: ctv1.id, status: 'DISBURSED' },
        }),
      });
      await ctx
        .http()
        .get(`${API}/commissions/summary`)
        .set(...bearer(staff))
        .expect(403);
    });
  });

  describe('approve and cancel', () => {
    async function pendingCommission(): Promise<string> {
      const lead = await silentDisbursedLead(ctv1.id, 40_000_000n);
      await commissions.createForLead(lead.id);
      return (await commissionOf(lead.id))!.id;
    }

    it('approves PENDING once (409 the second time) and audits it', async () => {
      const id = await pendingCommission();
      const res = await ctx
        .http()
        .patch(`${API}/commissions/${id}/approve`)
        .set(...bearer(admin))
        .expect(200);
      expect(res.body.status).toBe('APPROVED');

      const again = await ctx
        .http()
        .patch(`${API}/commissions/${id}/approve`)
        .set(...bearer(admin))
        .expect(409);
      expect(again.body.code).toBe('INVALID_COMMISSION_STATUS');

      const audit = await ctx.prisma.auditLog.findFirstOrThrow({
        where: { entityId: id, action: 'COMMISSION_APPROVED' },
      });
      expect(audit.actorId).toBe(admin.id);

      const summary = await ctx
        .http()
        .get(`${API}/commissions/summary`)
        .set(...bearer(ctv1))
        .expect(200);
      expect(summary.body.approved).toBe(600_000);
    });

    it('cancels with a reason; cancelled ones cannot change again', async () => {
      const id = await pendingCommission();
      await ctx
        .http()
        .patch(`${API}/commissions/${id}/cancel`)
        .set(...bearer(admin))
        .send({})
        .expect(400);
      const res = await ctx
        .http()
        .patch(`${API}/commissions/${id}/cancel`)
        .set(...bearer(admin))
        .send({ reason: 'Khách huỷ hợp đồng' })
        .expect(200);
      expect(res.body.status).toBe('CANCELLED');
      const stored = await ctx.prisma.commission.findUniqueOrThrow({
        where: { id },
      });
      expect(stored.cancelReason).toBe('Khách huỷ hợp đồng');

      await ctx
        .http()
        .patch(`${API}/commissions/${id}/approve`)
        .set(...bearer(admin))
        .expect(409);
    });

    it('is admin-only and 404s unknown ids', async () => {
      const id = await pendingCommission();
      await ctx
        .http()
        .patch(`${API}/commissions/${id}/approve`)
        .set(...bearer(staff))
        .expect(403);
      await ctx
        .http()
        .patch(
          `${API}/commissions/01a20b8d-6da3-73f4-8630-c05207776962/approve`,
        )
        .set(...bearer(admin))
        .expect(404);
    });
  });
});
