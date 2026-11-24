import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { AppConfig } from '../config/env.validation';
import { Role, UserStatus } from '../generated/prisma/enums';
import type { PrismaService } from '../prisma/prisma.service';
import type { JwtPayload } from './auth.types';
import { hashRefreshToken, TokenService } from './token.service';

const DAY_MS = 24 * 60 * 60 * 1000;

function setup() {
  const tx = {
    refreshToken: {
      create: jest.fn().mockResolvedValue({ id: 'new-token-id' }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const prisma = {
    refreshToken: {
      findUnique: jest.fn(),
      create: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    $transaction: jest.fn((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  const jwt = new JwtService({
    secret: 'unit-test-secret-that-is-long-enough-123',
  });
  const settings: Record<string, number> = {
    REFRESH_TOKEN_TTL_DAYS: 7,
    JWT_ACCESS_TTL_SECONDS: 900,
  };
  const config = {
    get: (key: string) => settings[key],
  } as unknown as ConfigService<AppConfig, true>;
  const service = new TokenService(
    prisma as unknown as PrismaService,
    jwt,
    config,
  );
  return { service, prisma, tx, jwt };
}

function storedToken(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'old-token-id',
    userId: 'user-1',
    familyId: 'family-1',
    expiresAt: new Date(Date.now() + DAY_MS),
    revokedAt: null,
    user: { id: 'user-1', role: Role.AFFILIATE, status: UserStatus.ACTIVE },
    ...overrides,
  };
}

describe('TokenService', () => {
  describe('issueTokenPair', () => {
    it('stores only the hash of the refresh token, with a 7-day expiry', async () => {
      const { service, prisma, jwt } = setup();
      const before = Date.now();

      const pair = await service.issueTokenPair({
        id: 'user-1',
        role: Role.STAFF,
      });

      const { data } = prisma.refreshToken.create.mock.calls[0][0];
      expect(data.tokenHash).toBe(hashRefreshToken(pair.refreshToken));
      expect(data.tokenHash).not.toContain(pair.refreshToken);
      expect(data.userId).toBe('user-1');
      expect(data.familyId).toMatch(/^[0-9a-f-]{36}$/);
      expect(data.expiresAt.getTime()).toBeGreaterThanOrEqual(
        before + 7 * DAY_MS,
      );

      expect(pair.expiresIn).toBe(900);
      const payload = await jwt.verifyAsync<JwtPayload>(pair.accessToken);
      expect(payload).toMatchObject({ sub: 'user-1', role: Role.STAFF });
    });

    it('returns a different, URL-safe refresh token each time', async () => {
      const { service } = setup();
      const a = await service.issueTokenPair({ id: 'u', role: Role.ADMIN });
      const b = await service.issueTokenPair({ id: 'u', role: Role.ADMIN });
      expect(a.refreshToken).not.toBe(b.refreshToken);
      expect(a.refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    });
  });

  describe('rotate', () => {
    it('replaces a valid token with a new one in the same family', async () => {
      const { service, prisma, tx } = setup();
      prisma.refreshToken.findUnique.mockResolvedValue(storedToken());

      const pair = await service.rotate('old-token');

      expect(prisma.refreshToken.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tokenHash: hashRefreshToken('old-token') },
        }),
      );
      const created = tx.refreshToken.create.mock.calls[0][0].data;
      expect(created.familyId).toBe('family-1');
      expect(created.tokenHash).toBe(hashRefreshToken(pair.refreshToken));
      expect(tx.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { id: 'old-token-id', revokedAt: null },
        data: { revokedAt: expect.any(Date), replacedById: 'new-token-id' },
      });
      expect(pair.refreshToken).not.toBe('old-token');
    });

    it('rejects an unknown token', async () => {
      const { service, prisma } = setup();
      prisma.refreshToken.findUnique.mockResolvedValue(null);
      await expect(service.rotate('nope')).rejects.toThrow(
        'Invalid refresh token',
      );
    });

    it('revokes the whole family when a rotated token is reused', async () => {
      const { service, prisma } = setup();
      prisma.refreshToken.findUnique.mockResolvedValue(
        storedToken({ revokedAt: new Date(Date.now() - 1000) }),
      );

      await expect(service.rotate('stolen')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { familyId: 'family-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects an expired token', async () => {
      const { service, prisma } = setup();
      prisma.refreshToken.findUnique.mockResolvedValue(
        storedToken({ expiresAt: new Date(Date.now() - 1) }),
      );
      await expect(service.rotate('old')).rejects.toThrow(
        'Refresh token has expired',
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('refuses a disabled user with 403 and ends the session', async () => {
      const { service, prisma } = setup();
      prisma.refreshToken.findUnique.mockResolvedValue(
        storedToken({
          user: {
            id: 'user-1',
            role: Role.AFFILIATE,
            status: UserStatus.DISABLED,
          },
        }),
      );
      await expect(service.rotate('old')).rejects.toThrow(ForbiddenException);
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { familyId: 'family-1', revokedAt: null },
        }),
      );
    });

    it('loses the race when another request already rotated the token', async () => {
      const { service, prisma, tx } = setup();
      prisma.refreshToken.findUnique.mockResolvedValue(storedToken());
      tx.refreshToken.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.rotate('old')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('revoke', () => {
    it('revokes only that token of that user', async () => {
      const { service, prisma } = setup();
      await service.revoke('some-token', 'user-1');
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: {
          tokenHash: hashRefreshToken('some-token'),
          userId: 'user-1',
          revokedAt: null,
        },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });
});
