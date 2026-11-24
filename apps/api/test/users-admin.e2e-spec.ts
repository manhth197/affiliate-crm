import { Role, UserStatus } from '../src/generated/prisma/enums';
import {
  actor,
  type Actor,
  API,
  bearer,
  createTestApp,
  createUser,
  login,
  PASSWORD,
  resetDatabase,
  type TestContext,
  uniqueEmail,
} from './utils';

describe('Users admin and staff directory (e2e)', () => {
  let ctx: TestContext;
  let admin: Actor;
  let staff: Actor;
  let affiliate: Actor;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.prisma);
    admin = await actor(ctx, Role.ADMIN, 'An Quản Trị');
    staff = await actor(ctx, Role.STAFF, 'Bùi Nhân Viên');
    affiliate = await actor(ctx, Role.AFFILIATE, 'Cao Cộng Tác');
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  describe('GET /users', () => {
    it('lists users for admins with filters and pagination', async () => {
      const res = await ctx
        .http()
        .get(`${API}/users?role=STAFF`)
        .set(...bearer(admin))
        .expect(200);
      expect(res.body.meta).toEqual({ page: 1, pageSize: 20, total: 1 });
      expect(res.body.data[0]).toEqual({
        id: staff.id,
        email: staff.email,
        fullName: 'Bùi Nhân Viên',
        phone: '0987654321',
        role: 'STAFF',
        status: 'ACTIVE',
        createdAt: expect.any(String),
      });

      const search = await ctx
        .http()
        .get(`${API}/users?q=${encodeURIComponent('cộng tác')}`)
        .set(...bearer(admin))
        .expect(200);
      expect(search.body.data.map((u: { id: string }) => u.id)).toEqual([
        affiliate.id,
      ]);
    });

    it('is admin-only', async () => {
      await ctx
        .http()
        .get(`${API}/users`)
        .set(...bearer(staff))
        .expect(403);
      await ctx
        .http()
        .get(`${API}/users`)
        .set(...bearer(affiliate))
        .expect(403);
    });
  });

  describe('POST /users', () => {
    it('creates a staff account that can log in, with an audit entry', async () => {
      const email = uniqueEmail('newstaff');
      const res = await ctx
        .http()
        .post(`${API}/users`)
        .set(...bearer(admin))
        .send({
          email,
          password: PASSWORD,
          fullName: 'Đỗ Minh Khoa',
          phone: '+84 987 111 222',
          role: 'STAFF',
        })
        .expect(201);
      expect(res.body).toMatchObject({
        email,
        role: 'STAFF',
        phone: '0987111222',
        status: 'ACTIVE',
      });
      await login(ctx, email);
      const audit = await ctx.prisma.auditLog.findFirst({
        where: { entityId: res.body.id, action: 'USER_CREATED' },
      });
      expect(audit?.actorId).toBe(admin.id);
    });

    it('cannot create affiliates and rejects duplicate emails', async () => {
      const base = {
        password: PASSWORD,
        fullName: 'X',
        phone: '0987111222',
      };
      await ctx
        .http()
        .post(`${API}/users`)
        .set(...bearer(admin))
        .send({ ...base, email: uniqueEmail('x'), role: 'AFFILIATE' })
        .expect(400);
      await ctx
        .http()
        .post(`${API}/users`)
        .set(...bearer(admin))
        .send({ ...base, email: staff.email.toUpperCase(), role: 'STAFF' })
        .expect(409);
    });
  });

  describe('PATCH /users/:id', () => {
    it('disabling a user ends their sessions immediately', async () => {
      const victim = await createUser(ctx, { role: Role.STAFF });
      const session = await login(ctx, victim.email);

      const res = await ctx
        .http()
        .patch(`${API}/users/${victim.id}`)
        .set(...bearer(admin))
        .send({ status: 'DISABLED', fullName: 'Nghỉ việc' })
        .expect(200);
      expect(res.body).toMatchObject({
        status: 'DISABLED',
        fullName: 'Nghỉ việc',
      });

      await ctx
        .http()
        .post(`${API}/auth/refresh`)
        .send({ refreshToken: session.refreshToken })
        .expect(401);
      await ctx
        .http()
        .post(`${API}/auth/login`)
        .send({ email: victim.email, password: PASSWORD })
        .expect(403);

      const audit = await ctx.prisma.auditLog.findFirstOrThrow({
        where: { entityId: victim.id, action: 'USER_UPDATED' },
      });
      expect(audit.before).toMatchObject({ status: 'ACTIVE' });
      expect(audit.after).toMatchObject({ status: 'DISABLED' });
    });

    it('stops admins from disabling themselves (422)', async () => {
      const res = await ctx
        .http()
        .patch(`${API}/users/${admin.id}`)
        .set(...bearer(admin))
        .send({ status: 'DISABLED' })
        .expect(422);
      expect(res.body.message).toBe('You cannot disable your own account');
      expect(res.body.code).toBe('CANNOT_DISABLE_SELF');
    });

    it('404s unknown users', async () => {
      await ctx
        .http()
        .patch(`${API}/users/01a20b8d-6da3-73f4-8630-c05207776962`)
        .set(...bearer(admin))
        .send({ fullName: 'Ai đó' })
        .expect(404);
    });
  });

  describe('GET /staff', () => {
    it('lists active staff and admins by name for staff and admins', async () => {
      await createUser(ctx, {
        role: Role.STAFF,
        status: UserStatus.DISABLED,
        fullName: 'Zz Đã Nghỉ',
      });
      for (const who of [staff, admin]) {
        const res = await ctx
          .http()
          .get(`${API}/staff`)
          .set(...bearer(who))
          .expect(200);
        const names = res.body.map((s: { fullName: string }) => s.fullName);
        expect(names).toContain('An Quản Trị');
        expect(names).toContain('Bùi Nhân Viên');
        expect(names).not.toContain('Zz Đã Nghỉ');
        expect(names).not.toContain('Cao Cộng Tác');
        expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
        expect(Object.keys(res.body[0]).sort()).toEqual([
          'fullName',
          'id',
          'role',
        ]);
      }
    });

    it('is not available to affiliates', async () => {
      await ctx
        .http()
        .get(`${API}/staff`)
        .set(...bearer(affiliate))
        .expect(403);
    });
  });
});
