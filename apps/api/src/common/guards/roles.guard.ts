import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { WorkspaceContext } from './workspace.guard';

/**
 * Compares the workspace role attached by WorkspaceGuard against the
 * @Roles(...) metadata on the handler/class. If no metadata is present,
 * any role is allowed (i.e. just being a member is enough).
 *
 * Must run AFTER JwtAuthGuard + WorkspaceGuard.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @Roles decorator means: any member of the workspace may proceed.
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const req = context.switchToHttp().getRequest<{ workspace?: WorkspaceContext }>();
    const role = req.workspace?.role;

    if (!role) {
      throw new ForbiddenException('Workspace context missing — apply WorkspaceGuard first');
    }
    if (!requiredRoles.includes(role)) {
      throw new ForbiddenException(`Role ${role} is not authorized for this action`);
    }
    return true;
  }
}
