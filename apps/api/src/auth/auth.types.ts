import type { Role } from '../generated/prisma/enums';

/** Claims inside the access token. Kept minimal: no PII in a JWT. */
export interface JwtPayload {
  sub: string;
  role: Role;
}

/** The authenticated caller, attached to `request.user` by JwtAuthGuard. */
export interface AuthUser {
  id: string;
  role: Role;
}
