import { SetMetadata } from '@nestjs/common';
import type { Role } from '../../generated/prisma/enums';

export const ROLES_KEY = 'roles';

/** Restricts a route (or controller) to the given roles. No decorator = any logged-in user. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
