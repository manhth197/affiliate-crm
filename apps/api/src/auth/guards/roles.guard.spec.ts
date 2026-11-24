import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../../generated/prisma/enums';
import type { AuthUser } from '../auth.types';
import { RolesGuard } from './roles.guard';

function contextFor(user: AuthUser | undefined): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const reflector = new Reflector();
  const guard = new RolesGuard(reflector);
  const affiliate: AuthUser = { id: 'u1', role: Role.AFFILIATE };
  const admin: AuthUser = { id: 'u2', role: Role.ADMIN };

  afterEach(() => jest.restoreAllMocks());

  function requireRoles(roles: Role[] | undefined) {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(roles);
  }

  it('allows any authenticated user when no @Roles is set', () => {
    requireRoles(undefined);
    expect(guard.canActivate(contextFor(affiliate))).toBe(true);
  });

  it('allows a user whose role is listed', () => {
    requireRoles([Role.STAFF, Role.ADMIN]);
    expect(guard.canActivate(contextFor(admin))).toBe(true);
  });

  it('rejects a user whose role is not listed with 403', () => {
    requireRoles([Role.STAFF, Role.ADMIN]);
    expect(() => guard.canActivate(contextFor(affiliate))).toThrow(
      ForbiddenException,
    );
  });

  it('rejects when there is no user on the request', () => {
    requireRoles([Role.ADMIN]);
    expect(() => guard.canActivate(contextFor(undefined))).toThrow(
      ForbiddenException,
    );
  });
});
