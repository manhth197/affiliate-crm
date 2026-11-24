import { JwtService } from '@nestjs/jwt';
import { Role, UserStatus } from '../src/generated/prisma/enums';
import {
  API,
  createTestApp,
  createUser,
  login,
  PASSWORD,
  refreshCookie,
  refreshWith,
  resetDatabase,
  type TestContext,
  uniqueEmail,
} from './utils';

describe('Auth (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.prisma);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  function register(overrides: Record<string, unknown> = {}) {
    return ctx
      .http()
      .post(`${API}/auth/register`)
      .send({
        email: uniqueEmail('ctv'),
        password: PASSWORD,
        fullName: 'Nguyễn Văn An',
        phone: '0912345678',
        ...overrides,
      });
  }

  describe('POST /auth/register', () => {
    it('creates an affiliate with a referral code and returns a session', async () => {
      const res = await register({
        email: '  New.Affiliate@Example.com ',
        fullName: '  Trần Thị Bình ',
        phone: '+84 912 345 678',
      }).expect(201);

      expect(res.body).toEqual({
        user: {
          id: expect.any(String),
          email: 'new.affiliate@example.com',
          fullName: 'Trần Thị Bình',
          phone: '0912345678',
          role: Role.AFFILIATE,
          status: UserStatus.ACTIVE,
          createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T.*Z$/),
          affiliate: {
            userId: res.body.user.id,
            referralCode: expect.stringMatching(/^CTV[A-HJ-NP-Z2-9]{6}$/),
            bankName: null,
            bankAccountMasked: null,
          },
        },
        accessToken: expect.any(String),
        expiresIn: 900,
      });
      expect(JSON.stringify(res.body)).not.toContain('passwordHash');
      // v0.7: the refresh token is only in the httpOnly cookie.
      expect(res.body).not.toHaveProperty('refreshToken');
      expect(refreshCookie(res)).toMatch(/^crm_rt=[A-Za-z0-9_-]{43}$/);
    });

    it('stores the password as an argon2id hash and the refresh token only as a hash', async () => {
      const email = uniqueEmail('hash');
      const res = await register({ email }).expect(201);

      const user = await ctx.prisma.user.findUniqueOrThrow({
        where: { email },
        include: { refreshTokens: true },
      });
      expect(user.passwordHash).toMatch(/^\$argon2id\$/);
      expect(user.refreshTokens).toHaveLength(1);
      const token = refreshCookie(res).slice('crm_rt='.length);
      expect(user.refreshTokens[0].tokenHash).not.toBe(token);
      expect(user.refreshTokens[0].tokenHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('rejects a duplicate email regardless of case with 409', async () => {
      const email = uniqueEmail('dup');
      await register({ email }).expect(201);

      const res = await register({ email: email.toUpperCase() }).expect(409);
      expect(res.body).toEqual({
        statusCode: 409,
        error: 'Conflict',
        code: 'EMAIL_TAKEN',
        message: 'Email is already registered',
      });
    });

    it('returns 400 with per-field details for invalid input', async () => {
      const res = await register({
        email: 'not-an-email',
        password: 'short',
        fullName: '',
        phone: '0241234567',
      }).expect(400);

      expect(res.body.statusCode).toBe(400);
      expect(res.body.error).toBe('Bad Request');
      expect(res.body.message).toBe('Validation failed');
      const fields = res.body.details.map((d: { field: string }) => d.field);
      expect(fields).toEqual(
        expect.arrayContaining(['email', 'password', 'fullName', 'phone']),
      );
      expect(res.body.details).toContainEqual({
        field: 'phone',
        message: 'must be a valid VN phone number',
      });
    });

    it('rejects unknown properties such as a self-assigned role', async () => {
      const res = await register({ role: 'ADMIN' }).expect(400);
      expect(res.body.details).toContainEqual({
        field: 'role',
        message: 'property role should not exist',
      });
    });
  });

  describe('POST /auth/login', () => {
    it('returns the user and a token pair', async () => {
      const email = uniqueEmail('login');
      await register({ email }).expect(201);

      const res = await ctx
        .http()
        .post(`${API}/auth/login`)
        .send({ email: email.toUpperCase(), password: PASSWORD })
        .expect(200);
      expect(res.body.user.email).toBe(email);
      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body).not.toHaveProperty('refreshToken');
      expect(refreshCookie(res)).toMatch(/^crm_rt=/);
    });

    it('gives the same 401 for a wrong password and an unknown email', async () => {
      const email = uniqueEmail('wrongpw');
      await register({ email }).expect(201);

      const wrongPassword = await ctx
        .http()
        .post(`${API}/auth/login`)
        .send({ email, password: 'Wrong@12345' })
        .expect(401);
      const unknownEmail = await ctx
        .http()
        .post(`${API}/auth/login`)
        .send({ email: uniqueEmail('ghost'), password: 'Wrong@12345' })
        .expect(401);

      expect(wrongPassword.body).toEqual(unknownEmail.body);
      expect(wrongPassword.body.message).toBe('Invalid email or password');
    });

    it('refuses a disabled account with 403', async () => {
      const disabled = await createUser(ctx, {
        role: Role.STAFF,
        status: UserStatus.DISABLED,
      });
      const res = await ctx
        .http()
        .post(`${API}/auth/login`)
        .send({ email: disabled.email, password: PASSWORD })
        .expect(403);
      expect(res.body.message).toBe('Account is disabled');
      expect(res.body.code).toBe('ACCOUNT_DISABLED');
    });

    it('lets staff log in without an affiliate profile', async () => {
      const staff = await createUser(ctx, { role: Role.STAFF });
      const res = await ctx
        .http()
        .post(`${API}/auth/login`)
        .send({ email: staff.email, password: PASSWORD })
        .expect(200);
      expect(res.body.user.role).toBe(Role.STAFF);
      expect(res.body.user).not.toHaveProperty('affiliate');
    });
  });

  describe('GET /auth/me', () => {
    it('returns the current user', async () => {
      const email = uniqueEmail('me');
      const { body } = await register({ email }).expect(201);

      const res = await ctx
        .http()
        .get(`${API}/auth/me`)
        .set('Authorization', `Bearer ${body.accessToken}`)
        .expect(200);
      expect(res.body).toEqual(body.user);
    });

    it('requires a token', async () => {
      const res = await ctx.http().get(`${API}/auth/me`).expect(401);
      expect(res.body).toEqual({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Missing access token',
      });
    });

    it('rejects a malformed token', async () => {
      await ctx
        .http()
        .get(`${API}/auth/me`)
        .set('Authorization', 'Bearer not.a.jwt')
        .expect(401);
    });

    it('rejects an expired token', async () => {
      const staff = await createUser(ctx, { role: Role.STAFF });
      const expired = await new JwtService({
        secret: process.env.JWT_ACCESS_SECRET,
      }).signAsync({
        sub: staff.id,
        role: Role.STAFF,
        exp: Math.floor(Date.now() / 1000) - 1,
      });
      await ctx
        .http()
        .get(`${API}/auth/me`)
        .set('Authorization', `Bearer ${expired}`)
        .expect(401);
    });
  });

  describe('POST /auth/refresh (crm_rt cookie only, v0.7)', () => {
    it('rotates: returns a new access token and cookie; the old cookie stops working', async () => {
      const first = refreshCookie(await register().expect(201));

      const res = await refreshWith(ctx, first).expect(200);
      expect(res.body).toEqual({
        accessToken: expect.any(String),
        expiresIn: 900,
      });
      const second = refreshCookie(res);
      expect(second).not.toBe(first);

      // The new access token works.
      await ctx
        .http()
        .get(`${API}/auth/me`)
        .set('Authorization', `Bearer ${res.body.accessToken}`)
        .expect(200);

      // The new cookie can be used once more.
      await refreshWith(ctx, second).expect(200);
    });

    it('revokes the whole session when an old cookie is replayed', async () => {
      const first = refreshCookie(await register().expect(201));
      const second = refreshCookie(await refreshWith(ctx, first).expect(200));

      // Attacker replays the stolen, already-rotated token.
      const replay = await refreshWith(ctx, first).expect(401);
      expect(replay.body.message).toBe('Refresh token has been revoked');

      // The legitimate latest token is now revoked too.
      await refreshWith(ctx, second).expect(401);
    });

    it('does not affect other sessions of the same user', async () => {
      const email = uniqueEmail('multi');
      const laptop = refreshCookie(await register({ email }).expect(201));
      const phone = await login(ctx, email);

      await refreshWith(ctx, laptop).expect(200);
      await refreshWith(ctx, laptop).expect(401);

      await refreshWith(ctx, phone.cookie).expect(200);
    });

    it('401s an unknown cookie and a missing cookie; 400s any body property', async () => {
      await refreshWith(ctx, 'crm_rt=made-up-token').expect(401);

      const missing = await ctx
        .http()
        .post(`${API}/auth/refresh`)
        .send({})
        .expect(401);
      expect(missing.body.message).toBe('Missing refresh token');

      // Old clients that still send the token in the body get a clear 400.
      const legacy = await ctx
        .http()
        .post(`${API}/auth/refresh`)
        .send({ refreshToken: 'anything' })
        .expect(400);
      expect(legacy.body.details).toEqual([
        {
          field: 'refreshToken',
          message: 'property refreshToken should not exist',
        },
      ]);
    });

    it('refuses to refresh once the account is disabled', async () => {
      const email = uniqueEmail('disable');
      const cookie = refreshCookie(await register({ email }).expect(201));
      await ctx.prisma.user.update({
        where: { email },
        data: { status: UserStatus.DISABLED },
      });

      await refreshWith(ctx, cookie).expect(403);
    });
  });

  describe('POST /auth/logout', () => {
    it('revokes the cookie token and returns 204', async () => {
      const res = await register().expect(201);
      const cookie = refreshCookie(res);

      const logout = await ctx
        .http()
        .post(`${API}/auth/logout`)
        .set('Authorization', `Bearer ${res.body.accessToken}`)
        .set('Cookie', cookie)
        .send({})
        .expect(204);
      expect(logout.text).toBe('');

      await refreshWith(ctx, cookie).expect(401);
    });

    it("cannot revoke another user's refresh token", async () => {
      const victim = refreshCookie(await register().expect(201));
      const attacker = (await register().expect(201)).body;

      await ctx
        .http()
        .post(`${API}/auth/logout`)
        .set('Authorization', `Bearer ${attacker.accessToken}`)
        .set('Cookie', victim)
        .send({})
        .expect(204);

      await refreshWith(ctx, victim).expect(200);
    });

    it('requires an access token', async () => {
      await ctx.http().post(`${API}/auth/logout`).send({}).expect(401);
    });
  });

  describe('PATCH /auth/me', () => {
    it('lets an affiliate update profile and bank details (returned masked, audited masked)', async () => {
      const email = uniqueEmail('profile');
      const session = (await register({ email }).expect(201)).body;

      const res = await ctx
        .http()
        .patch(`${API}/auth/me`)
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({
          fullName: ' Nguyễn Văn Mới ',
          phone: '+84 987 654 321',
          bankName: 'Vietcombank',
          bankAccountNumber: '0123 456 789',
        })
        .expect(200);
      expect(res.body).toMatchObject({
        fullName: 'Nguyễn Văn Mới',
        phone: '0987654321',
        affiliate: { bankName: 'Vietcombank', bankAccountMasked: '******6789' },
      });
      expect(JSON.stringify(res.body)).not.toContain('0123456789');

      const stored = await ctx.prisma.affiliateProfile.findFirstOrThrow({
        where: { user: { email } },
      });
      expect(stored.bankAccount).toBe('0123456789');

      const audit = await ctx.prisma.auditLog.findFirstOrThrow({
        where: { entityId: res.body.id, action: 'PROFILE_UPDATED' },
      });
      expect(JSON.stringify(audit)).not.toContain('0123456789');
      expect(audit.after).toMatchObject({ bankAccountMasked: '******6789' });
    });

    it('forbids bank details for staff but allows other fields', async () => {
      const staff = await createUser(ctx, { role: Role.STAFF });
      const { accessToken } = await login(ctx, staff.email);
      await ctx
        .http()
        .patch(`${API}/auth/me`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ bankName: 'Vietcombank' })
        .expect(403);
      const res = await ctx
        .http()
        .patch(`${API}/auth/me`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ fullName: 'Nhân Viên Mới' })
        .expect(200);
      expect(res.body.fullName).toBe('Nhân Viên Mới');
    });

    it('validates input and refuses fields it does not own', async () => {
      const session = (await register().expect(201)).body;
      const res = await ctx
        .http()
        .patch(`${API}/auth/me`)
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({ bankAccountNumber: 'abc', role: 'ADMIN' })
        .expect(400);
      const fields = res.body.details.map((d: { field: string }) => d.field);
      expect(fields).toEqual(
        expect.arrayContaining(['bankAccountNumber', 'role']),
      );
    });
  });
});
