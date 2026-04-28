import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Attach required workspace roles to a route. RolesGuard reads this
 * metadata and ensures the caller's role (set by WorkspaceGuard) is
 * one of the listed values.
 *
 * Example: @Roles('OWNER', 'ADMIN')
 */
export const Roles = (...roles: Role[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
