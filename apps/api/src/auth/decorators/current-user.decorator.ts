import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from '../auth.types';

export type AuthenticatedRequest = Request & { user?: AuthUser };

/** Injects the authenticated caller set by JwtAuthGuard. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) {
      // Only reachable if a @Public() route asks for the user by mistake.
      throw new UnauthorizedException();
    }
    return request.user;
  },
);
