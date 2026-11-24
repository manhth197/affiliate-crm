import { getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { CommissionsService } from '../src/commissions/commissions.service';
import { QueueName } from '../src/queues/queues';
import { vnMonth } from '../src/common/dates';
import { LeadStatus, Role } from '../src/generated/prisma/enums';
import {
  actor,
  type Actor,
  API,
  bearer,
  createProduct,
  createTestApp,
  nextCustomerPhone,
  resetDatabase,
  type TestContext,
  waitFor,
} from './utils';

describe('Payouts (e2e, BullMQ job + real DB)', () => {
  let ctx: TestContext;
  let commissions: CommissionsService;
  let admin: Actor;
  let staff: Actor;
  let ctv1: Actor;
  let ctv2: Actor;
  let product: { id: string };
  const month = vnMonth(new Date());

  /** Creates a commission (1.5% of `amount`) and optionally approves it. */
  async function commission(
    affiliate: Actor,
    amount: bigint,
    approve: boolean,
  ): Promise<string> {
    const lead = await ctx.prisma.lead.create({
      data: {
        affiliateId: affiliate.id,
        productId: product.id,
        customerName: 'Khách Payout',
        customerNameSearch: 'khach payout',
        customerPhone: nextCustomerPhone(),
        status: LeadStatus.DISBURSED,
        disbursedAmount: amount,
      },
    });
    await commissions.createForLead(lead.id);
    const { id } = await ctx.prisma.commission.findUniqueOrThrow({
      where: { leadId: lead.id },
    });
    if (approve) {
      await ctx
        .http()
        .patch(`${API}/commissions/${id}/approve`)
        .set(...bearer(admin))
        .expect(200);
    }
    return id;
  }

  /** Requests generation and waits until the BullMQ job has completed. */
  async function generate(): Promise<void> {
    const res = await ctx
      .http()
      .post(`${API}/payouts/generate`)
      .set(...bearer(admin))
      .send({ month })
      .expect(202);
    expect(res.body).toEqual({ jobId: expect.any(String) });
    const queue = ctx.app.get<Queue>(getQueueToken(QueueName.Payouts));
    await waitFor(
      async () => (await queue.getJobState(res.body.jobId)) === 'completed',
    );
  }

  const payoutOf = (affiliateId: string) =>
    ctx.prisma.payout.findUnique({
      where: { affiliateId_periodMonth: { affiliateId, periodMonth: month } },
    });

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.prisma);
    commissions = ctx.app.get(CommissionsService);
    admin = await actor(ctx, Role.ADMIN);
    staff = await actor(ctx, Role.STAFF);
    ctv1 = await actor(ctx, Role.AFFILIATE, 'Nguyễn Văn An');
    ctv2 = await actor(ctx, Role.AFFILIATE, 'Trần Thị Bình');
    product = await createProduct(ctx, { commissionValue: 150 });
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('groups APPROVED commissions of the month into one DRAFT payout per affiliate', async () => {
    const a1 = await commission(ctv1, 100_000_000n, true); // 1,500,000
    const a2 = await commission(ctv1, 20_000_000n, true); // 300,000
    const pending = await commission(ctv1, 50_000_000n, false); // stays out
    await commission(ctv2, 40_000_000n, true); // 600,000

    await generate();
    const payout = await waitFor(() => payoutOf(ctv1.id));
    expect(payout).toMatchObject({
      status: 'DRAFT',
      totalAmount: 1_800_000n,
      commissionCount: 2,
    });
    const inPayout = await ctx.prisma.commission.findMany({
      where: { payoutId: payout.id },
      select: { id: true },
    });
    expect(inPayout.map((c) => c.id).sort()).toEqual([a1, a2].sort());
    expect(
      (
        await ctx.prisma.commission.findUniqueOrThrow({
          where: { id: pending },
        })
      ).payoutId,
    ).toBeNull();
    expect((await waitFor(() => payoutOf(ctv2.id))).totalAmount).toBe(600_000n);
  });

  it('tops up a DRAFT payout on re-run without double counting', async () => {
    await commission(ctv1, 10_000_000n, true); // +150,000
    await generate();
    await waitFor(async () => {
      const p = await payoutOf(ctv1.id);
      return p?.commissionCount === 3 ? p : null;
    });
    expect((await payoutOf(ctv1.id))!.totalAmount).toBe(1_950_000n);
    expect(
      await ctx.prisma.payout.count({ where: { affiliateId: ctv1.id } }),
    ).toBe(1);
  });

  it('lists payouts: affiliates see only their own', async () => {
    const mine = await ctx
      .http()
      .get(`${API}/payouts?affiliateId=${ctv2.id}`)
      .set(...bearer(ctv1))
      .expect(200);
    expect(mine.body.meta.total).toBe(1);
    expect(mine.body.data[0]).toEqual({
      id: expect.any(String),
      affiliate: { id: ctv1.id, fullName: 'Nguyễn Văn An' },
      periodMonth: month,
      totalAmount: 1_950_000,
      commissionCount: 3,
      status: 'DRAFT',
      paidAt: null,
      createdAt: expect.any(String),
    });

    const all = await ctx
      .http()
      .get(`${API}/payouts?month=${month}&status=DRAFT`)
      .set(...bearer(admin))
      .expect(200);
    expect(all.body.meta.total).toBe(2);
  });

  it('confirms, then marks paid: commissions become PAID and the affiliate is notified', async () => {
    const payout = (await payoutOf(ctv1.id))!;

    await ctx
      .http()
      .patch(`${API}/payouts/${payout.id}/mark-paid`)
      .set(...bearer(admin))
      .expect(409)
      .expect((res) => expect(res.body.code).toBe('INVALID_PAYOUT_STATUS'));

    const confirmed = await ctx
      .http()
      .patch(`${API}/payouts/${payout.id}/confirm`)
      .set(...bearer(admin))
      .expect(200);
    expect(confirmed.body.status).toBe('CONFIRMED');
    await ctx
      .http()
      .patch(`${API}/payouts/${payout.id}/confirm`)
      .set(...bearer(admin))
      .expect(409);

    const paid = await ctx
      .http()
      .patch(`${API}/payouts/${payout.id}/mark-paid`)
      .set(...bearer(admin))
      .expect(200);
    expect(paid.body).toMatchObject({
      status: 'PAID',
      paidAt: expect.any(String),
    });

    const statuses = await ctx.prisma.commission.findMany({
      where: { payoutId: payout.id },
      select: { status: true },
    });
    expect(statuses.every((c) => c.status === 'PAID')).toBe(true);

    const notification = await waitFor(() =>
      ctx.prisma.notification.findFirst({
        where: { userId: ctv1.id, type: 'PAYOUT_PAID' },
      }),
    );
    expect(notification.data).toEqual({
      payoutId: payout.id,
      periodMonth: month,
      totalAmount: '1950000',
    });

    const audit = await ctx.prisma.auditLog.findMany({
      where: { entityId: payout.id },
      select: { action: true },
    });
    expect(audit.map((a) => a.action)).toEqual(
      expect.arrayContaining([
        'PAYOUT_GENERATED',
        'PAYOUT_CONFIRMED',
        'PAYOUT_PAID',
      ]),
    );

    const summary = await ctx
      .http()
      .get(`${API}/commissions/summary`)
      .set(...bearer(ctv1))
      .expect(200);
    expect(summary.body.paid).toBe(1_950_000);
  });

  it('leaves a paid payout alone when generating again, and protects its commissions', async () => {
    const late = await commission(ctv1, 30_000_000n, true);
    await generate();
    const payout = (await payoutOf(ctv1.id))!;
    expect(payout).toMatchObject({ status: 'PAID', commissionCount: 3 });
    expect(
      (await ctx.prisma.commission.findUniqueOrThrow({ where: { id: late } }))
        .payoutId,
    ).toBeNull();

    const paidCommission = await ctx.prisma.commission.findFirstOrThrow({
      where: { payoutId: payout.id },
    });
    await ctx
      .http()
      .patch(`${API}/commissions/${paidCommission.id}/cancel`)
      .set(...bearer(admin))
      .send({ reason: 'test' })
      .expect(409);
  });

  it('is admin-only and validates the month', async () => {
    await ctx
      .http()
      .post(`${API}/payouts/generate`)
      .set(...bearer(staff))
      .send({ month })
      .expect(403);
    await ctx
      .http()
      .post(`${API}/payouts/generate`)
      .set(...bearer(admin))
      .send({ month: '2026-13' })
      .expect(400);
  });
});
