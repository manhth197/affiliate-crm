import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  CommissionType,
  ProductCategory,
  Role,
  UserStatus,
} from '../src/generated/prisma/enums';
import { LeadEvents, LeadStatusChangedEvent } from '../src/leads/lead.events';
import {
  actor,
  type Actor,
  API,
  bearer,
  createProduct,
  createTestApp,
  createUser,
  resetDatabase,
  type TestContext,
} from './utils';

describe('Leads (e2e)', () => {
  let ctx: TestContext;
  let admin: Actor;
  let staff: Actor;
  let ctv1: Actor;
  let ctv2: Actor;
  let loan: { id: string };
  let card: { id: string };
  let retired: { id: string };
  let phoneCounter = 0;

  /** Distinct customer phone per lead, so the duplicate rule does not interfere. */
  function nextPhone(): string {
    phoneCounter += 1;
    return `09${String(10_000_000 + phoneCounter).slice(-8)}`;
  }

  function submit(who: Actor, overrides: Record<string, unknown> = {}) {
    return ctx
      .http()
      .post(`${API}/leads`)
      .set(...bearer(who))
      .send({
        productId: loan.id,
        customerName: 'Hoàng Thị Mai',
        customerPhone: nextPhone(),
        customerNationalId: '001203004123',
        requestedAmount: 50_000_000,
        ...overrides,
      });
  }

  function setStatus(id: string, body: Record<string, unknown>, who = staff) {
    return ctx
      .http()
      .patch(`${API}/leads/${id}/status`)
      .set(...bearer(who))
      .send(body);
  }

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.prisma);
    admin = await actor(ctx, Role.ADMIN, 'Lê Quản Trị');
    staff = await actor(ctx, Role.STAFF, 'Phạm Thu Hà');
    ctv1 = await actor(ctx, Role.AFFILIATE, 'Nguyễn Văn An');
    ctv2 = await actor(ctx, Role.AFFILIATE, 'Trần Thị Bình');
    loan = await createProduct(ctx);
    card = await createProduct(ctx, {
      name: 'Thẻ tín dụng',
      category: ProductCategory.CREDIT_CARD,
      commissionType: CommissionType.FIXED,
      commissionValue: 500_000,
    });
    retired = await createProduct(ctx, { name: 'Ngừng bán', active: false });
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  describe('POST /leads', () => {
    it('creates a NEW lead with a code, masked PII and a CREATED activity', async () => {
      const res = await submit(ctv1, {
        customerPhone: '0912345689',
        note: 'Khách cần vay gấp',
      }).expect(201);

      expect(res.body).toEqual({
        id: expect.any(String),
        code: expect.stringMatching(/^LD-\d{6}$/),
        affiliate: {
          id: ctv1.id,
          fullName: 'Nguyễn Văn An',
          referralCode: expect.stringMatching(/^CTV/),
        },
        product: {
          id: loan.id,
          name: 'Vay tiêu dùng tín chấp',
          partnerName: 'FE Credit',
        },
        customerName: 'Hoàng Thị Mai',
        customerPhone: '09******89',
        customerNationalId: '*********123',
        requestedAmount: 50_000_000,
        disbursedAmount: null,
        status: 'NEW',
        assignedStaff: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });

      const activities = await ctx
        .http()
        .get(`${API}/leads/${res.body.id}/activities`)
        .set(...bearer(ctv1))
        .expect(200);
      expect(activities.body).toEqual([
        expect.objectContaining({
          type: 'CREATED',
          toStatus: 'NEW',
          note: 'Khách cần vay gấp',
          actor: { id: ctv1.id, fullName: 'Nguyễn Văn An' },
        }),
      ]);
    });

    it('is for affiliates only', async () => {
      await submit(staff).expect(403);
      await submit(admin).expect(403);
    });

    it('rejects inactive products and requestedAmount on non-loan products (422)', async () => {
      const inactive = await submit(ctv1, { productId: retired.id }).expect(
        422,
      );
      expect(inactive.body.message).toBe('Product is not available');
      expect(inactive.body.code).toBe('PRODUCT_UNAVAILABLE');
      const nonLoan = await submit(ctv1, { productId: card.id }).expect(422);
      expect(nonLoan.body.code).toBe('AMOUNT_NOT_ALLOWED');
      expect(nonLoan.body.message).toBe(
        'requestedAmount is only allowed for LOAN products',
      );
      await submit(ctv1, {
        productId: card.id,
        requestedAmount: undefined,
      }).expect(201);
    });

    it('validates the body', async () => {
      const res = await submit(ctv1, {
        customerPhone: '12345',
        customerNationalId: '1234567890',
        requestedAmount: -5,
        productId: 'nope',
      }).expect(400);
      const fields = res.body.details.map((d: { field: string }) => d.field);
      expect(fields).toEqual(
        expect.arrayContaining([
          'customerPhone',
          'customerNationalId',
          'requestedAmount',
          'productId',
        ]),
      );
    });

    it('refuses a second open lead for the same customer and product (409), even from another affiliate', async () => {
      const phone = nextPhone();
      const first = await submit(ctv1, { customerPhone: phone }).expect(201);
      const dup = await submit(ctv2, {
        customerPhone: `+84 ${phone.slice(1)}`,
      }).expect(409);
      expect(dup.body.code).toBe('DUPLICATE_LEAD');
      expect(dup.body.message).toBe(
        'This customer already has an open lead for this product',
      );

      // Once the first lead is closed, the customer can be referred again.
      await setStatus(first.body.id, { status: 'REJECTED' }).expect(200);
      await submit(ctv2, { customerPhone: phone }).expect(201);
    });

    it('lets only one of several concurrent duplicate submissions through', async () => {
      const phone = nextPhone();
      const results = await Promise.all(
        Array.from({ length: 5 }, () => submit(ctv1, { customerPhone: phone })),
      );
      const statuses = results.map((r) => r.status).sort();
      expect(statuses).toEqual([201, 409, 409, 409, 409]);
    });
  });

  describe('GET /leads and GET /leads/:id', () => {
    let ctv2Lead: { id: string; code: string };

    beforeAll(async () => {
      const res = await submit(ctv2, {
        customerName: 'Đặng Văn Tài',
        customerPhone: '0977000111',
      }).expect(201);
      ctv2Lead = res.body;
    });

    it('limits affiliates to their own leads, even with affiliateId', async () => {
      const res = await ctx
        .http()
        .get(`${API}/leads?affiliateId=${ctv2.id}&pageSize=100`)
        .set(...bearer(ctv1))
        .expect(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      for (const lead of res.body.data) {
        expect(lead.affiliate.id).toBe(ctv1.id);
        expect(lead.customerPhone).toMatch(/^\d{2}\*+\d{2}$/);
      }
    });

    it('lets staff see everything, paginated, unmasked', async () => {
      const total = await ctx.prisma.lead.count();
      const res = await ctx
        .http()
        .get(`${API}/leads?page=2&pageSize=2`)
        .set(...bearer(staff))
        .expect(200);
      expect(res.body.meta).toEqual({ page: 2, pageSize: 2, total });
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].customerPhone).toMatch(/^0\d{9}$/);
    });

    it('filters by affiliate, status, search and date range', async () => {
      const byAffiliate = await ctx
        .http()
        .get(`${API}/leads?affiliateId=${ctv2.id}&status=NEW`)
        .set(...bearer(staff))
        .expect(200);
      expect(
        byAffiliate.body.data.every(
          (l: { affiliate: { id: string }; status: string }) =>
            l.affiliate.id === ctv2.id && l.status === 'NEW',
        ),
      ).toBe(true);

      for (const q of [
        ctv2Lead.code,
        'đặng văn',
        'dang van tai', // accent-insensitive
        'ĐẶNG',
        '0977 000',
      ]) {
        const res = await ctx
          .http()
          .get(`${API}/leads?q=${encodeURIComponent(q)}`)
          .set(...bearer(staff))
          .expect(200);
        expect(res.body.data.map((l: { id: string }) => l.id)).toEqual([
          ctv2Lead.id,
        ]);
      }

      const future = await ctx
        .http()
        .get(
          `${API}/leads?from=${encodeURIComponent('2099-01-01T00:00:00+07:00')}`,
        )
        .set(...bearer(staff))
        .expect(200);
      expect(future.body.meta.total).toBe(0);

      const untilNow = await ctx
        .http()
        .get(`${API}/leads?to=${encodeURIComponent(new Date().toISOString())}`)
        .set(...bearer(staff))
        .expect(200);
      expect(untilNow.body.meta.total).toBeGreaterThan(0);
    });

    it('sorts by an allowed field', async () => {
      const res = await ctx
        .http()
        .get(`${API}/leads?sort=createdAt:asc&pageSize=100`)
        .set(...bearer(staff))
        .expect(200);
      const times = res.body.data.map(
        (l: { createdAt: string }) => l.createdAt,
      );
      expect(times).toEqual([...times].sort());
    });

    it.each([
      ['sort=customerPhone:asc'],
      ['pageSize=101'],
      ['from=2026-11-01'],
      ['status=WON'],
      ['productId=123'],
    ])('rejects invalid query %s with 400', async (query) => {
      await ctx
        .http()
        .get(`${API}/leads?${query}`)
        .set(...bearer(staff))
        .expect(400);
    });

    it('returns one lead to its owner (masked) and to staff (unmasked)', async () => {
      const owner = await ctx
        .http()
        .get(`${API}/leads/${ctv2Lead.id}`)
        .set(...bearer(ctv2))
        .expect(200);
      expect(owner.body.customerPhone).toBe('09******11');

      const asStaff = await ctx
        .http()
        .get(`${API}/leads/${ctv2Lead.id}`)
        .set(...bearer(staff))
        .expect(200);
      expect(asStaff.body.customerPhone).toBe('0977000111');
    });

    it("forbids another affiliate's lead (403), 404s unknown ids, 400s malformed ids", async () => {
      await ctx
        .http()
        .get(`${API}/leads/${ctv2Lead.id}`)
        .set(...bearer(ctv1))
        .expect(403);
      await ctx
        .http()
        .get(`${API}/leads/${ctv2Lead.id}/activities`)
        .set(...bearer(ctv1))
        .expect(403);
      await ctx
        .http()
        .get(`${API}/leads/01a20b8d-6da3-73f4-8630-c05207776962`)
        .set(...bearer(staff))
        .expect(404);
      await ctx
        .http()
        .get(`${API}/leads/123`)
        .set(...bearer(staff))
        .expect(400);
    });
  });

  describe('PATCH /leads/:id/status', () => {
    it('walks the whole pipeline, writing activity + audit and emitting events', async () => {
      const events: LeadStatusChangedEvent[] = [];
      const emitter = ctx.app.get(EventEmitter2);
      const listener = (e: LeadStatusChangedEvent) => events.push(e);
      emitter.on(LeadEvents.StatusChanged, listener);

      const lead = (await submit(ctv1).expect(201)).body;
      for (const status of ['CONTACTED', 'SUBMITTED', 'APPROVED']) {
        const res = await setStatus(lead.id, { status }).expect(200);
        expect(res.body.status).toBe(status);
      }
      const done = await setStatus(lead.id, {
        status: 'DISBURSED',
        disbursedAmount: 45_000_000,
        note: 'Giải ngân đủ',
      }).expect(200);
      expect(done.body).toMatchObject({
        status: 'DISBURSED',
        disbursedAmount: 45_000_000,
      });
      emitter.off(LeadEvents.StatusChanged, listener);

      expect(events.map((e) => `${e.from}>${e.to}`)).toEqual([
        'NEW>CONTACTED',
        'CONTACTED>SUBMITTED',
        'SUBMITTED>APPROVED',
        'APPROVED>DISBURSED',
      ]);
      expect(events[3]).toMatchObject({
        leadId: lead.id,
        leadCode: lead.code,
        affiliateId: ctv1.id,
        actorId: staff.id,
      });

      const audit = await ctx.prisma.auditLog.findMany({
        where: { entityId: lead.id, action: 'LEAD_STATUS_CHANGED' },
        orderBy: { createdAt: 'asc' },
      });
      expect(audit).toHaveLength(4);
      expect(audit[3]).toMatchObject({
        actorId: staff.id,
        before: { status: 'APPROVED' },
        after: { status: 'DISBURSED', disbursedAmount: 45_000_000 },
      });

      const timeline = await ctx
        .http()
        .get(`${API}/leads/${lead.id}/activities`)
        .set(...bearer(ctv1))
        .expect(200);
      expect(timeline.body.map((a: { type: string }) => a.type)).toEqual([
        'STATUS_CHANGED',
        'STATUS_CHANGED',
        'STATUS_CHANGED',
        'STATUS_CHANGED',
        'CREATED',
      ]);
      expect(timeline.body[0]).toMatchObject({
        fromStatus: 'APPROVED',
        toStatus: 'DISBURSED',
        note: 'Giải ngân đủ',
        actor: { id: staff.id, fullName: 'Phạm Thu Hà' },
      });
    });

    it('rejects skipping a step with 409 and a helpful message', async () => {
      const lead = (await submit(ctv1).expect(201)).body;
      const res = await setStatus(lead.id, { status: 'APPROVED' }).expect(409);
      expect(res.body).toEqual({
        statusCode: 409,
        error: 'Conflict',
        code: 'INVALID_TRANSITION',
        message:
          'Cannot change status from NEW to APPROVED; allowed: CONTACTED, REJECTED',
      });
    });

    it('treats REJECTED and DISBURSED as final', async () => {
      const lead = (await submit(ctv1).expect(201)).body;
      await setStatus(lead.id, { status: 'REJECTED', note: 'Nợ xấu' }).expect(
        200,
      );
      const res = await setStatus(lead.id, { status: 'CONTACTED' }).expect(409);
      expect(res.body.message).toBe(
        'Cannot change status from REJECTED: it is final',
      );
    });

    it('requires disbursedAmount exactly when DISBURSED', async () => {
      const lead = (await submit(ctv1).expect(201)).body;
      const extra = await setStatus(lead.id, {
        status: 'CONTACTED',
        disbursedAmount: 1,
      }).expect(400);
      expect(extra.body.details[0].field).toBe('disbursedAmount');

      for (const status of ['CONTACTED', 'SUBMITTED', 'APPROVED']) {
        await setStatus(lead.id, { status }).expect(200);
      }
      const missing = await setStatus(lead.id, { status: 'DISBURSED' }).expect(
        400,
      );
      expect(missing.body.details).toContainEqual({
        field: 'disbursedAmount',
        message: 'is required (integer VND) when status is DISBURSED',
      });
    });

    it('lets only one of two simultaneous changes win (409 for the other)', async () => {
      const lead = (await submit(ctv1).expect(201)).body;
      const [a, b] = await Promise.all([
        setStatus(lead.id, { status: 'CONTACTED' }),
        setStatus(lead.id, { status: 'REJECTED' }, admin),
      ]);
      expect([a.status, b.status].sort()).toEqual([200, 409]);
      const loser = a.status === 409 ? a : b;
      // Usually CONCURRENT_UPDATE; INVALID_TRANSITION if the winner committed
      // before the loser even read the lead.
      expect(['CONCURRENT_UPDATE', 'INVALID_TRANSITION']).toContain(
        loser.body.code,
      );
      const activities = await ctx.prisma.leadActivity.count({
        where: { leadId: lead.id, type: 'STATUS_CHANGED' },
      });
      expect(activities).toBe(1);
    });

    it('is for staff and admins only', async () => {
      const lead = (await submit(ctv1).expect(201)).body;
      await setStatus(lead.id, { status: 'CONTACTED' }, ctv1).expect(403);
      await setStatus(lead.id, { status: 'CONTACTED' }, admin).expect(200);
    });
  });

  describe('assign, notes and timeline visibility', () => {
    it('assigns to active staff, records it, and is idempotent', async () => {
      const lead = (await submit(ctv1).expect(201)).body;
      const assign = () =>
        ctx
          .http()
          .patch(`${API}/leads/${lead.id}/assign`)
          .set(...bearer(admin))
          .send({ staffId: staff.id });

      const res = await assign().expect(200);
      expect(res.body.assignedStaff).toEqual({
        id: staff.id,
        fullName: 'Phạm Thu Hà',
      });
      await assign().expect(200);

      const assigned = await ctx.prisma.leadActivity.findMany({
        where: { leadId: lead.id, type: 'ASSIGNED' },
      });
      expect(assigned).toHaveLength(1);
      expect(assigned[0]).toMatchObject({ assigneeId: staff.id, note: null });

      const timeline = await ctx
        .http()
        .get(`${API}/leads/${lead.id}/activities`)
        .set(...bearer(staff))
        .expect(200);
      expect(timeline.body[0]).toMatchObject({
        type: 'ASSIGNED',
        assignee: { id: staff.id, fullName: 'Phạm Thu Hà' },
        actor: { id: admin.id, fullName: 'Lê Quản Trị' },
      });

      const unassigned = await ctx
        .http()
        .get(`${API}/leads?assignedStaffId=none&pageSize=100`)
        .set(...bearer(staff))
        .expect(200);
      const unassignedIds = unassigned.body.data.map(
        (l: { id: string }) => l.id,
      );
      expect(unassignedIds).not.toContain(lead.id);
      expect(
        unassigned.body.data.every(
          (l: { assignedStaff: unknown }) => l.assignedStaff === null,
        ),
      ).toBe(true);
      expect(unassigned.body.meta.total).toBeGreaterThan(0);

      const mine = await ctx
        .http()
        .get(`${API}/leads?assignedStaffId=${staff.id}`)
        .set(...bearer(staff))
        .expect(200);
      expect(mine.body.data.map((l: { id: string }) => l.id)).toContain(
        lead.id,
      );
    });

    it('refuses to assign to an affiliate or a disabled staff member (422)', async () => {
      const lead = (await submit(ctv1).expect(201)).body;
      const disabled = await createUser(ctx, {
        role: Role.STAFF,
        status: UserStatus.DISABLED,
      });
      for (const staffId of [ctv2.id, disabled.id]) {
        await ctx
          .http()
          .patch(`${API}/leads/${lead.id}/assign`)
          .set(...bearer(staff))
          .send({ staffId })
          .expect(422)
          .expect((res) => expect(res.body.code).toBe('ASSIGNEE_NOT_STAFF'));
      }
      await ctx
        .http()
        .patch(`${API}/leads/${lead.id}/assign`)
        .set(...bearer(ctv1))
        .send({ staffId: staff.id })
        .expect(403);
    });

    it('hides internal notes from the affiliate', async () => {
      const lead = (await submit(ctv1).expect(201)).body;
      const note = await ctx
        .http()
        .post(`${API}/leads/${lead.id}/notes`)
        .set(...bearer(staff))
        .send({ note: 'Khách khó tính, gọi sau 17h' })
        .expect(201);
      expect(note.body).toMatchObject({
        leadId: lead.id,
        type: 'NOTE',
        note: 'Khách khó tính, gọi sau 17h',
        actor: { id: staff.id, fullName: 'Phạm Thu Hà' },
      });
      await ctx
        .http()
        .post(`${API}/leads/${lead.id}/notes`)
        .set(...bearer(ctv1))
        .send({ note: 'hi' })
        .expect(403);

      const forStaff = await ctx
        .http()
        .get(`${API}/leads/${lead.id}/activities`)
        .set(...bearer(staff))
        .expect(200);
      expect(forStaff.body.map((a: { type: string }) => a.type)).toEqual([
        'NOTE',
        'CREATED',
      ]);
      const forOwner = await ctx
        .http()
        .get(`${API}/leads/${lead.id}/activities`)
        .set(...bearer(ctv1))
        .expect(200);
      expect(forOwner.body.map((a: { type: string }) => a.type)).toEqual([
        'CREATED',
      ]);
    });
  });

  describe('GET /leads/export.csv', () => {
    it('streams an unmasked UTF-8 CSV with BOM to admins', async () => {
      const lead = (
        await submit(ctv2, {
          customerName: 'Vũ Thị "Lan", Hà Nội',
          customerPhone: '0966555444',
        }).expect(201)
      ).body;

      const res = await ctx
        .http()
        .get(`${API}/leads/export.csv?affiliateId=${ctv2.id}&page=3`)
        .set(...bearer(admin))
        .buffer(true)
        .parse((response, callback) => {
          const chunks: Buffer[] = [];
          response.on('data', (c: Buffer) => chunks.push(c));
          response.on('end', () => callback(null, Buffer.concat(chunks)));
        })
        .expect(200);

      expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
      expect(res.headers['content-disposition']).toMatch(
        /^attachment; filename="leads-\d{4}-\d{2}-\d{2}\.csv"$/,
      );
      const text = (res.body as Buffer).toString('utf8');
      expect(text.startsWith('﻿Mã lead,Ngày tạo,Trạng thái')).toBe(true);
      const lines = text.trim().split('\r\n');
      const expectedRows = await ctx.prisma.lead.count({
        where: { affiliateId: ctv2.id },
      });
      expect(lines).toHaveLength(expectedRows + 1);
      const row = lines.find((l) => l.startsWith(lead.code));
      expect(row).toContain('"Vũ Thị ""Lan"", Hà Nội"');
      expect(row).toContain('0966555444');
    });

    it('is admin-only', async () => {
      await ctx
        .http()
        .get(`${API}/leads/export.csv`)
        .set(...bearer(staff))
        .expect(403);
    });
  });
});
