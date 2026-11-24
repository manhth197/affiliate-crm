import { Role } from '../src/generated/prisma/enums';
import { signWebhook } from '../src/webhooks/hmac';
import { TEST_PARTNERS } from './test-env';
import {
  actor,
  type Actor,
  advanceLead,
  API,
  bearer,
  createProduct,
  createTestApp,
  resetDatabase,
  submitLead,
  type TestContext,
  waitFor,
} from './utils';

const [AN_PHAT, SAO_VIET] = TEST_PARTNERS;

describe('Partner webhook (e2e)', () => {
  let ctx: TestContext;
  let staff: Actor;
  let ctv: Actor;
  let anPhatProduct: { id: string };
  let saoVietProduct: { id: string };
  let eventCounter = 0;

  const nextEventId = () => `evt-${Date.now()}-${++eventCounter}`;
  const now = () => String(Math.floor(Date.now() / 1000));

  /**
   * Sends `body` exactly as serialised here, signed like a partner would.
   * `override` lets a test break one part of the signature.
   */
  function send(
    body: Record<string, unknown>,
    override: {
      partner?: { id: string; secret: string };
      timestamp?: string;
      signature?: string;
      rawBody?: string;
      omit?: 'X-Partner-Id' | 'X-Timestamp' | 'X-Signature';
    } = {},
  ) {
    const partner = override.partner ?? AN_PHAT;
    const timestamp = override.timestamp ?? now();
    const raw = JSON.stringify(body);
    const headers: Record<string, string> = {
      'X-Partner-Id': partner.id,
      'X-Timestamp': timestamp,
      'X-Signature':
        override.signature ?? signWebhook(partner.secret, timestamp, raw),
    };
    if (override.omit) {
      delete headers[override.omit];
    }
    return ctx
      .http()
      .post(`${API}/webhooks/partner-status`)
      .set(headers)
      .set('Content-Type', 'application/json')
      .send(override.rawBody ?? raw);
  }

  async function leadAt(
    status: 'NEW' | 'SUBMITTED' | 'APPROVED',
    productId = anPhatProduct.id,
  ) {
    const lead = await submitLead(ctx, ctv, productId);
    if (status !== 'NEW') {
      await advanceLead(ctx, staff, lead.id, status);
    }
    return lead;
  }

  const statusOf = async (id: string) =>
    (await ctx.prisma.lead.findUniqueOrThrow({ where: { id } })).status;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.prisma);
    staff = await actor(ctx, Role.STAFF);
    ctv = await actor(ctx, Role.AFFILIATE);
    anPhatProduct = await createProduct(ctx, { partnerName: AN_PHAT.name });
    saoVietProduct = await createProduct(ctx, {
      name: 'Vay mua xe',
      partnerName: SAO_VIET.name,
    });
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  describe('happy path and idempotency', () => {
    it('applies a signed update through the status service (WEBHOOK activity, no actor, audited)', async () => {
      const lead = await leadAt('SUBMITTED');
      const eventId = nextEventId();

      const res = await send({
        eventId,
        leadCode: lead.code,
        status: 'APPROVED',
        note: 'Hồ sơ đạt',
      }).expect(200);
      expect(res.body).toEqual({ ok: true });
      expect(await statusOf(lead.id)).toBe('APPROVED');

      const timeline = await ctx
        .http()
        .get(`${API}/leads/${lead.id}/activities`)
        .set(...bearer(ctv))
        .expect(200);
      expect(timeline.body[0]).toMatchObject({
        type: 'WEBHOOK',
        fromStatus: 'SUBMITTED',
        toStatus: 'APPROVED',
        note: 'Hồ sơ đạt',
        actor: null,
      });

      const audit = await ctx.prisma.auditLog.findFirstOrThrow({
        where: {
          entityId: lead.id,
          action: 'LEAD_STATUS_CHANGED',
          actorId: null,
        },
      });
      expect(audit.metadata).toEqual({ partnerId: AN_PHAT.id, eventId });
    });

    it('acknowledges a repeated eventId without applying it twice', async () => {
      const lead = await leadAt('SUBMITTED');
      const body = {
        eventId: nextEventId(),
        leadCode: lead.code,
        status: 'APPROVED',
      };

      await send(body).expect(200);
      const again = await send(body).expect(200);
      expect(again.body).toEqual({ ok: true, duplicate: true });
      expect(
        await ctx.prisma.leadActivity.count({
          where: { leadId: lead.id, type: 'WEBHOOK' },
        }),
      ).toBe(1);
    });

    it('applies only one of several concurrent deliveries of the same event', async () => {
      const lead = await leadAt('SUBMITTED');
      const body = {
        eventId: nextEventId(),
        leadCode: lead.code,
        status: 'REJECTED',
      };

      const results = await Promise.all([send(body), send(body), send(body)]);
      expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
      const fresh = results.filter((r) => r.body.duplicate !== true);
      expect(fresh).toHaveLength(1);
      expect(
        await ctx.prisma.leadActivity.count({
          where: { leadId: lead.id, type: 'WEBHOOK' },
        }),
      ).toBe(1);
    });

    it('creates the commission when the partner reports DISBURSED', async () => {
      const lead = await leadAt('APPROVED');
      await send({
        eventId: nextEventId(),
        leadCode: lead.code,
        status: 'DISBURSED',
        disbursedAmount: 80_000_000,
      }).expect(200);

      const commission = await waitFor(() =>
        ctx.prisma.commission.findUnique({ where: { leadId: lead.id } }),
      );
      expect(commission.amount).toBe(1_200_000n); // 1.5% of 80,000,000
    });
  });

  describe('authentication (all failures are the same 401)', () => {
    const body = () => ({
      eventId: nextEventId(),
      leadCode: 'LD-000001',
      status: 'APPROVED',
    });

    it.each([
      // Overrides are built when the test runs, not when it is declared, so the
      // timestamps are relative to the real request time. Exact ±300 s
      // boundaries are covered by the unit tests of isFreshTimestamp.
      [
        'unknown partner',
        () => ({ partner: { id: 'nobody', secret: 'x'.repeat(20) } }),
      ],
      [
        'wrong secret',
        () => ({ partner: { id: AN_PHAT.id, secret: SAO_VIET.secret } }),
      ],
      ['malformed signature', () => ({ signature: 'not-hex' })],
      [
        'timestamp older than 5 minutes',
        () => ({ timestamp: String(Number(now()) - 360) }),
      ],
      [
        'timestamp too far in the future',
        () => ({ timestamp: String(Number(now()) + 360) }),
      ],
      ['missing X-Signature', () => ({ omit: 'X-Signature' as const })],
      ['missing X-Timestamp', () => ({ omit: 'X-Timestamp' as const })],
    ])('rejects %s', async (_label, override) => {
      const res = await send(body(), override()).expect(401);
      expect(res.body.message).toBe('Invalid webhook signature');
    });

    it('rejects a body changed after signing', async () => {
      const original = body();
      const timestamp = now();
      const signature = signWebhook(
        AN_PHAT.secret,
        timestamp,
        JSON.stringify(original),
      );
      await send(original, {
        timestamp,
        signature,
        rawBody: JSON.stringify({ ...original, status: 'DISBURSED' }),
      }).expect(401);
    });

    it('validates the body only after the signature (400 for a signed bad body)', async () => {
      const res = await send({
        eventId: nextEventId(),
        leadCode: 'LD-000001',
        status: 'NEW',
      }).expect(400);
      expect(res.body.details[0].field).toBe('status');
    });
  });

  describe('business errors', () => {
    it("404s unknown leads and other partners' leads alike", async () => {
      const unknown = await send({
        eventId: nextEventId(),
        leadCode: 'LD-999999',
        status: 'APPROVED',
      }).expect(404);
      const saoVietLead = await leadAt('SUBMITTED', saoVietProduct.id);
      const foreign = await send({
        eventId: nextEventId(),
        leadCode: saoVietLead.code,
        status: 'APPROVED',
      }).expect(404);
      expect(foreign.body).toEqual(unknown.body);
      expect(await statusOf(saoVietLead.id)).toBe('SUBMITTED');
    });

    it('409s an invalid transition and does not mark the event as processed', async () => {
      const lead = await leadAt('NEW');
      const body = {
        eventId: nextEventId(),
        leadCode: lead.code,
        status: 'APPROVED',
      };

      const res = await send(body).expect(409);
      expect(res.body.code).toBe('INVALID_TRANSITION');
      expect(
        await ctx.prisma.webhookEvent.count({
          where: { eventId: body.eventId },
        }),
      ).toBe(0);

      // Once staff catch up, the partner's retry of the same event succeeds.
      await advanceLead(ctx, staff, lead.id, 'SUBMITTED');
      const retry = await send(body).expect(200);
      expect(retry.body).toEqual({ ok: true });
      expect(await statusOf(lead.id)).toBe('APPROVED');
    });

    it('422s DISBURSED without an amount', async () => {
      const lead = await leadAt('APPROVED');
      const res = await send({
        eventId: nextEventId(),
        leadCode: lead.code,
        status: 'DISBURSED',
      }).expect(422);
      expect(res.body.code).toBe('DISBURSED_AMOUNT_REQUIRED');
      expect(await statusOf(lead.id)).toBe('APPROVED');
    });
  });
});
