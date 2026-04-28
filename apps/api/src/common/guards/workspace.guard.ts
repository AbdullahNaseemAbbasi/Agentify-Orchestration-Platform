import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Request } from 'express';
import { JwtUser } from '../../modules/auth/strategies/jwt.strategy';
import { WorkspacesService } from '../../modules/workspaces/workspaces.service';

export interface WorkspaceContext {
  id: string;
  slug: string;
  name: string;
  role: Role;
}

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Resolves the workspace from `X-Workspace-Id` header (or `:workspaceId` URL
 * param when present), verifies the authenticated user is a member, and
 * attaches the WorkspaceContext to the request as `req.workspace`.
 *
 * Must be used AFTER JwtAuthGuard so `req.user` is already populated.
 */
@Injectable()
export class WorkspaceGuard implements CanActivate {
  constructor(private readonly workspaces: WorkspacesService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Request & { user?: JwtUser; workspace?: WorkspaceContext; params: { workspaceId?: string } }
    >();

    if (!req.user) {
      throw new UnauthorizedException('Authentication required');
    }

    const headerValue = req.header('x-workspace-id');
    const paramValue = req.params?.workspaceId;
    const workspaceId = (paramValue ?? headerValue ?? '').trim();

    if (!workspaceId) {
      throw new BadRequestException('Missing X-Workspace-Id header or :workspaceId param');
    }
    if (!UUID_V4.test(workspaceId)) {
      throw new BadRequestException('Workspace id must be a UUID v4');
    }

    let membership;
    try {
      membership = await this.workspaces.requireMembership(workspaceId, req.user.id);
    } catch (err) {
      if (err instanceof NotFoundException) {
        throw err;
      }
      throw err;
    }

    req.workspace = {
      id: membership.workspace.id,
      slug: membership.workspace.slug,
      name: membership.workspace.name,
      role: membership.role,
    };
    return true;
  }
}
