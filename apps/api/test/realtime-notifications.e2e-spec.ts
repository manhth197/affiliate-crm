import { JwtService } from '@nestjs/jwt';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { io, type Socket } from 'socket.io-client';
import { Role } from '../src/generated/prisma/enums';
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

describe('Realtime (Socket.IO) and notifications (e2e)', () => {
  let ctx: TestContext;
  let baseUrl: string;
  let admin: Actor;
  let staff: Actor;
  let staff2: Actor;
  let ctv1: Actor;
  let ctv2: Actor;
  let product: { id: string };
  const sockets: Socket[] = [];

  /** Connects to /realtime; resolves once connected or rejects on connect_error. */
  function connect(token?: string): Promise<Socket> {
    const socket = io(`${baseUrl}/realtime`, {
      auth: token === undefined ? {} : { token },
      transports: ['websocket'],
      reconnection: false,
    });
    sockets.push(socket);
    return new Promise((resolve, reject) => {
      socket.once('connect', () => resolve(socket));
      socket.once('connect_error', (error) => reject(error));
    });
  }

  /** Collects every payload of `event` received by `socket`. */
  function record<T>(socket: Socket, event: string): T[] {
    const received: T[] = [];
    socket.on(event, (payload: T) => received.push(payload));
    return received;
  }

  beforeAll(async () => {
    ctx = await createTestApp();
    await ctx.app.listen(0);
    const server = ctx.app.getHttpServer() as unknown as Server;
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
    await resetDatabase(ctx.prisma);
    admin = await actor(ctx, Role.ADMIN, 'Lê Quản Trị');
    staff = await actor(ctx, Role.STAFF, 'Phạm Thu Hà');
    staff2 = await actor(ctx, Role.STAFF, 'Đỗ Minh Khoa');
    ctv1 = await actor(ctx, Role.AFFILIATE, 'Nguyễn Văn An');
    ctv2 = await actor(ctx, Role.AFFILIATE, 'Trần Thị Bình');
    product = await createProduct(ctx);
  });

  afterEach(() => {
    while (sockets.length > 0) {
      sockets.pop()!.disconnect();
    }
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  describe('handshake', () => {
    it.each([
      ['no token', undefined],
      ['a garbage token', 'not-a-jwt'],
    ])('refuses %s', async (_label, token) => {
      await expect(connect(token)).rejects.toThrow('Unauthorized');
    });

    it('refuses a token signed with another secret', async () => {
      const forged = await new JwtService({
        secret: 'some-other-secret-some-other-secret',
      }).signAsync({ sub: ctv1.id, role: 'ADMIN' }, { expiresIn: 60 });
      await expect(connect(forged)).rejects.toThrow('Unauthorized');
    });

    it('disconnects the socket when the access token expires', async () => {
      const shortLived = await new JwtService({
        secret: process.env.JWT_ACCESS_SECRET,
      }).signAsync({ sub: ctv1.id, role: 'AFFILIATE' }, { expiresIn: 2 });
      const socket = await connect(shortLived);
      const reason = await new Promise<string>((resolve) =>
        socket.once('disconnect', resolve),
      );
      expect(reason).toBe('io server disconnect');
    }, 10_000);
  });

  describe('events', () => {
    it('pushes lead:updated to the owner and to staff/admin, not to other affiliates', async () => {
      const [ownerSocket, otherSocket, staffSocket, adminSocket] =
        await Promise.all([
          connect(ctv1.token),
          connect(ctv2.token),
          connect(staff.token),
          connect(admin.token),
        ]);
      const owner = record(ownerSocket, 'lead:updated');
      const other = record(otherSocket, 'lead:updated');
      const staffEvents = record(staffSocket, 'lead:updated');
      const adminEvents = record(adminSocket, 'lead:updated');

      const lead = await submitLead(ctx, ctv1, product.id);
      await advanceLead(ctx, staff, lead.id, 'CONTACTED');

      const expected = {
        leadId: lead.id,
        status: 'CONTACTED',
        updatedAt: expect.stringMatching(/Z$/),
      };
      await waitFor(() => owner.length > 0 && staffEvents.length > 0);
      expect(owner).toEqual([expected]);
      expect(staffEvents).toEqual([expected]);
      await waitFor(() => adminEvents.length > 0);
      expect(adminEvents).toEqual([expected]);
      expect(other).toEqual([]);
    });

    it('stores a notification and pushes notification:new to its owner', async () => {
      const socket = await connect(ctv1.token);
      const pushed = record<{
        id: string;
        type: string;
        title: string;
        data: Record<string, string>;
      }>(socket, 'notification:new');

      const lead = await submitLead(ctx, ctv1, product.id);
      await advanceLead(ctx, staff, lead.id, 'CONTACTED');

      // Earlier tests may still have notifications in flight: wait for ours.
      const mine = await waitFor(() =>
        pushed.find((n) => n.data.leadId === lead.id),
      );
      expect(mine).toMatchObject({
        type: 'LEAD_STATUS_CHANGED',
        title: `Lead ${lead.code}: Đã liên hệ`,
        data: { leadId: lead.id, leadCode: lead.code, status: 'CONTACTED' },
        readAt: null,
      });
      const stored = await ctx.prisma.notification.findUniqueOrThrow({
        where: { id: mine.id },
      });
      expect(stored.userId).toBe(ctv1.id);
    });

    it('notifies the assignee, except when staff assign themselves', async () => {
      const lead = await submitLead(ctx, ctv1, product.id);
      await ctx
        .http()
        .patch(`${API}/leads/${lead.id}/assign`)
        .set(...bearer(admin))
        .send({ staffId: staff2.id })
        .expect(200);
      const notification = await waitFor(() =>
        ctx.prisma.notification.findFirst({
          where: { userId: staff2.id, type: 'LEAD_ASSIGNED' },
        }),
      );
      expect(notification.title).toBe(`Bạn được giao lead ${lead.code}`);

      const selfAssigned = await submitLead(ctx, ctv1, product.id);
      await ctx
        .http()
        .patch(`${API}/leads/${selfAssigned.id}/assign`)
        .set(...bearer(staff))
        .send({ staffId: staff.id })
        .expect(200);
      // Give the worker time to (not) deliver anything.
      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(
        await ctx.prisma.notification.count({
          where: { userId: staff.id, type: 'LEAD_ASSIGNED' },
        }),
      ).toBe(0);
    });
  });

  describe('notifications API', () => {
    let mine: { id: string }[];

    beforeAll(async () => {
      // ctv2 gets three status-change notifications.
      const lead = await submitLead(ctx, ctv2, product.id);
      await advanceLead(ctx, staff, lead.id, 'APPROVED');
      await waitFor(
        async () =>
          (await ctx.prisma.notification.count({
            where: { userId: ctv2.id },
          })) >= 3,
      );
      mine = await ctx.prisma.notification.findMany({
        where: { userId: ctv2.id },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('lists my notifications newest first with the unread count', async () => {
      const res = await ctx
        .http()
        .get(`${API}/notifications?pageSize=2`)
        .set(...bearer(ctv2))
        .expect(200);
      expect(res.body.meta).toEqual({ page: 1, pageSize: 2, total: 3 });
      expect(res.body.unreadCount).toBe(3);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].title).toMatch(/Đã duyệt$/);
    });

    it('marks one as read (owner only) and filters unread', async () => {
      const id = mine[0].id;
      await ctx
        .http()
        .patch(`${API}/notifications/${id}/read`)
        .set(...bearer(ctv1))
        .expect(403);
      const res = await ctx
        .http()
        .patch(`${API}/notifications/${id}/read`)
        .set(...bearer(ctv2))
        .expect(200);
      expect(res.body.readAt).toEqual(expect.any(String));

      const unread = await ctx
        .http()
        .get(`${API}/notifications?unread=true`)
        .set(...bearer(ctv2))
        .expect(200);
      expect(unread.body.meta.total).toBe(2);
      expect(unread.body.unreadCount).toBe(2);
      expect(unread.body.data.map((n: { id: string }) => n.id)).not.toContain(
        id,
      );

      await ctx
        .http()
        .patch(`${API}/notifications/01a20b8d-6da3-73f4-8630-c05207776962/read`)
        .set(...bearer(ctv2))
        .expect(404);
    });

    it('marks all as read with 204', async () => {
      await ctx
        .http()
        .patch(`${API}/notifications/read-all`)
        .set(...bearer(ctv2))
        .expect(204);
      const res = await ctx
        .http()
        .get(`${API}/notifications`)
        .set(...bearer(ctv2))
        .expect(200);
      expect(res.body.unreadCount).toBe(0);
    });
  });
});
