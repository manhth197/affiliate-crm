import {
  CommissionStatus,
  LeadStatus,
  Role,
} from '../src/generated/prisma/enums';
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
} from './utils';

const FROM = '2026-10-01T00:00:00+07:00';
const TO = '2026-10-04T00:00:00+07:00';
const range = `from=${encodeURIComponent(FROM)}&to=${encodeURIComponent(TO)}`;

describe('Reports (e2e, SQL aggregates)', () => {
  let ctx: TestContext;
  let staff: Actor;
  let ctvA: Actor;
  let ctvB: Actor;
  let product: { id: string };

  async function lead(
    affiliate: Actor,
    createdAt: string,
    status: LeadStatus,
    commission?: { amount: bigint; status: CommissionStatus },
  ) {
    const created = await ctx.prisma.lead.create({
      data: {
        affiliateId: affiliate.id,
        productId: product.id,
        customerName: 'Khách Báo Cáo',
        customerNameSearch: 'khach bao cao',
        customerPhone: nextCustomerPhone(),
        status,
        disbursedAmount: status === LeadStatus.DISBURSED ? 10_000_000n : null,
        createdAt: new Date(createdAt),
      },
    });
    if (commission) {
      await ctx.prisma.commission.create({
        data: {
          leadId: created.id,
          affiliateId: affiliate.id,
          amount: commission.amount,
          status: commission.status,
          createdAt: new Date(createdAt),
        },
      });
    }
  }

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.prisma);
    staff = await actor(ctx, Role.STAFF);
    ctvA = await actor(ctx, Role.AFFILIATE, 'An');
    ctvB = await actor(ctx, Role.AFFILIATE, 'Bình');
    product = await createProduct(ctx);

    // Outside the range (both edges of the half-open interval).
    await lead(ctvA, '2026-09-30T23:59:00+07:00', LeadStatus.NEW);
    await lead(ctvA, '2026-10-04T00:00:00+07:00', LeadStatus.NEW);
    // Day 1 (Vietnam time) — 23:30 local is still Oct 1 although 16:30Z.
    await lead(ctvA, '2026-10-01T08:00:00+07:00', LeadStatus.NEW);
    await lead(ctvA, '2026-10-01T23:30:00+07:00', LeadStatus.DISBURSED, {
      amount: 150_000n,
      status: CommissionStatus.PENDING,
    });
    // Day 2 — 00:30 local is Oct 2 although still Oct 1 in UTC.
    await lead(ctvB, '2026-10-02T00:30:00+07:00', LeadStatus.DISBURSED, {
      amount: 500_000n,
      status: CommissionStatus.APPROVED,
    });
    await lead(ctvB, '2026-10-02T10:00:00+07:00', LeadStatus.DISBURSED, {
      amount: 200_000n,
      status: CommissionStatus.CANCELLED,
    });
    await lead(ctvB, '2026-10-02T11:00:00+07:00', LeadStatus.REJECTED);
    // Day 3: nothing.
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('GET /reports/overview aggregates [from, to) with Vietnam-day buckets', async () => {
    const res = await ctx
      .http()
      .get(`${API}/reports/overview?${range}`)
      .set(...bearer(staff))
      .expect(200);

    expect(res.body).toEqual({
      leadsByStatus: {
        NEW: 1,
        CONTACTED: 0,
        SUBMITTED: 0,
        APPROVED: 0,
        DISBURSED: 3,
        REJECTED: 1,
      },
      conversionRate: 0.6, // 3 of 5
      disbursedAmount: 30_000_000,
      commissionByStatus: {
        PENDING: 150_000,
        APPROVED: 500_000,
        PAID: 0,
        CANCELLED: 200_000,
      },
      leadsPerDay: [
        { date: '2026-10-01', count: 2 },
        { date: '2026-10-02', count: 3 },
        { date: '2026-10-03', count: 0 },
      ],
    });
  });

  it('GET /reports/top-affiliates ranks by commission (cancelled excluded)', async () => {
    const res = await ctx
      .http()
      .get(`${API}/reports/top-affiliates?${range}`)
      .set(...bearer(staff))
      .expect(200);
    expect(res.body).toEqual([
      {
        affiliate: {
          id: ctvB.id,
          fullName: 'Bình',
          referralCode: expect.stringMatching(/^CTV/),
        },
        leads: 3,
        disbursed: 2,
        commission: 500_000,
      },
      {
        affiliate: {
          id: ctvA.id,
          fullName: 'An',
          referralCode: expect.stringMatching(/^CTV/),
        },
        leads: 2,
        disbursed: 1,
        commission: 150_000,
      },
    ]);

    const limited = await ctx
      .http()
      .get(`${API}/reports/top-affiliates?${range}&limit=1`)
      .set(...bearer(staff))
      .expect(200);
    expect(limited.body).toHaveLength(1);
  });

  it('defaults to the last 30 days when no range is given', async () => {
    const res = await ctx
      .http()
      .get(`${API}/reports/overview`)
      .set(...bearer(staff))
      .expect(200);
    expect(res.body.leadsPerDay.length).toBeGreaterThanOrEqual(30);
    expect(res.body.leadsPerDay.length).toBeLessThanOrEqual(31);
  });

  it('validates the range and is staff/admin only', async () => {
    await ctx
      .http()
      .get(`${API}/reports/overview?from=2026-10-01`)
      .set(...bearer(staff))
      .expect(400);
    await ctx
      .http()
      .get(
        `${API}/reports/overview?from=${encodeURIComponent(TO)}&to=${encodeURIComponent(FROM)}`,
      )
      .set(...bearer(staff))
      .expect(400);
    await ctx
      .http()
      .get(`${API}/reports/top-affiliates?limit=500`)
      .set(...bearer(staff))
      .expect(400);
    await ctx
      .http()
      .get(`${API}/reports/overview`)
      .set(...bearer(ctvA))
      .expect(403);
  });
});
