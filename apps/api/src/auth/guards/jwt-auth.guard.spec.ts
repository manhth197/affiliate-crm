import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Role } from '../../generated/prisma/enums';
import type { AuthenticatedRequest } from '../decorators/current-user.decorator';
import { extractBearerToken, JwtAuthGuard } from './jwt-auth.guard';

const SECRET = 'unit-test-secret-that-is-long-enough-123';

function contextFor(request: Partial<AuthenticatedRequest>): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('extractBearerToken', () => {
  it.each([
    ['Bearer abc', 'abc'],
    ['bearer abc', 'abc'],
    ['Basic abc', null],
    ['Bearer', null],
    ['', null],
    [undefined, null],
  ])('%p -> %p', (header, expected) => {
    expect(extractBearerToken(header)).toBe(expected);
  });
});

describe('JwtAuthGuard', () => {
  const jwt = new JwtService({
    secret: SECRET,
    signOptions: { expiresIn: 60 },
  });
  const reflector = new Reflector();
  const guard = new JwtAuthGuard(jwt, reflector);

  afterEach(() => jest.restoreAllMocks());

  function markPublic(value: boolean) {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(value);
  }

  it('lets @Public() routes through without a token', async () => {
    markPublic(true);
    await expect(guard.canActivate(contextFor({ headers: {} }))).resolves.toBe(
      true,
    );
  });

  it('attaches the user from a valid token', async () => {
    markPublic(false);
    const token = await jwt.signAsync({ sub: 'user-1', role: Role.STAFF });
    const request: Partial<AuthenticatedRequest> = {
      headers: { authorization: `Bearer ${token}` },
    };
    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.user).toEqual({ id: 'user-1', role: Role.STAFF });
  });

  it('rejects a missing token with 401', async () => {
    markPublic(false);
    await expect(
      guard.canActivate(contextFor({ headers: {} })),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a token signed with another secret', async () => {
    markPublic(false);
    const forged = await new JwtService({
      secret: 'another-secret-another-secret-123',
    }).signAsync({
      sub: 'user-1',
      role: Role.ADMIN,
    });
    await expect(
      guard.canActivate(
        contextFor({ headers: { authorization: `Bearer ${forged}` } }),
      ),
    ).rejects.toThrow('Invalid or expired access token');
  });

  it('rejects an expired token', async () => {
    markPublic(false);
    // Signed without a default expiresIn so we can set exp in the past.
    const expired = await new JwtService({ secret: SECRET }).signAsync({
      sub: 'user-1',
      role: Role.ADMIN,
      exp: Math.floor(Date.now() / 1000) - 10,
    });
    await expect(
      guard.canActivate(
        contextFor({ headers: { authorization: `Bearer ${expired}` } }),
      ),
    ).rejects.toThrow(UnauthorizedException);
  });
});
