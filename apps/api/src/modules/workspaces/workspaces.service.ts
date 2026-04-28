import { randomBytes } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role, Workspace, WorkspaceMember } from '@prisma/client';
import { PrismaService } from '@agentify/database';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';

export type WorkspaceWithRole = Workspace & { role: Role };

@Injectable()
export class WorkspacesService {
  private readonly logger = new Logger(WorkspacesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** All workspaces the user is a member of, with their role attached. */
  async findAllForUser(userId: string): Promise<WorkspaceWithRole[]> {
    const memberships = await this.prisma.workspaceMember.findMany({
      where: { userId },
      include: { workspace: true },
      orderBy: { joinedAt: 'asc' },
    });

    return memberships
      .filter((m) => m.workspace.deletedAt === null)
      .map((m) => ({ ...m.workspace, role: m.role }));
  }

  /** Single workspace if the user is a member; otherwise 403/404. */
  async findByIdForUser(workspaceId: string, userId: string): Promise<WorkspaceWithRole> {
    const membership = await this.requireMembership(workspaceId, userId);
    return { ...membership.workspace, role: membership.role };
  }

  async create(dto: CreateWorkspaceDto, ownerId: string): Promise<WorkspaceWithRole> {
    const slug = await this.resolveSlug(dto.slug ?? this.slugify(dto.name));

    try {
      return await this.prisma.$transaction(async (tx) => {
        const workspace = await tx.workspace.create({
          data: { slug, name: dto.name, ownerId },
        });

        await tx.workspaceMember.create({
          data: { workspaceId: workspace.id, userId: ownerId, role: 'OWNER' },
        });

        this.logger.log(`User ${ownerId} created workspace ${workspace.id} (${slug})`);
        return { ...workspace, role: 'OWNER' as Role };
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('A workspace with this slug already exists');
      }
      throw err;
    }
  }

  async update(
    workspaceId: string,
    userId: string,
    dto: UpdateWorkspaceDto,
  ): Promise<WorkspaceWithRole> {
    const membership = await this.requireMembership(workspaceId, userId);
    if (!this.canManageWorkspace(membership.role)) {
      throw new ForbiddenException('Only owners or admins can update the workspace');
    }

    const updated = await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { name: dto.name },
    });
    return { ...updated, role: membership.role };
  }

  async softDelete(workspaceId: string, userId: string): Promise<void> {
    const membership = await this.requireMembership(workspaceId, userId);
    if (membership.role !== 'OWNER') {
      throw new ForbiddenException('Only the owner can delete the workspace');
    }

    await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { deletedAt: new Date() },
    });
    this.logger.log(`Workspace ${workspaceId} soft-deleted by ${userId}`);
  }

  // ----------------------------------------------
  // Members
  // ----------------------------------------------

  async listMembers(workspaceId: string): Promise<
    Array<{
      userId: string;
      role: Role;
      joinedAt: Date;
      email: string;
      name: string;
    }>
  > {
    const rows = await this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: { user: { select: { id: true, email: true, name: true } } },
      orderBy: { joinedAt: 'asc' },
    });
    return rows.map((m) => ({
      userId: m.user.id,
      role: m.role,
      joinedAt: m.joinedAt,
      email: m.user.email,
      name: m.user.name,
    }));
  }

  async inviteMember(
    workspaceId: string,
    invitedById: string,
    email: string,
    role: Role = 'MEMBER',
  ): Promise<{ userId: string; role: Role }> {
    if (role === 'OWNER') {
      throw new ForbiddenException('Cannot invite a user as OWNER — only the creator is the owner');
    }

    const target = await this.prisma.user.findFirst({
      where: { email: email.toLowerCase(), deletedAt: null },
    });
    if (!target) {
      throw new NotFoundException(`No user found with email ${email}`);
    }

    const existing = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: target.id },
    });
    if (existing) {
      throw new ConflictException('User is already a member of this workspace');
    }

    const member = await this.prisma.workspaceMember.create({
      data: { workspaceId, userId: target.id, invitedById, role },
    });
    this.logger.log(
      `User ${invitedById} invited ${target.id} (${email}) to workspace ${workspaceId} as ${role}`,
    );
    return { userId: target.id, role: member.role };
  }

  async updateMemberRole(
    workspaceId: string,
    actorRole: Role,
    targetUserId: string,
    newRole: Role,
  ): Promise<{ userId: string; role: Role }> {
    if (newRole === 'OWNER') {
      throw new ForbiddenException('Promoting to OWNER is not supported here — use transfer ownership');
    }

    const target = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: targetUserId },
    });
    if (!target) {
      throw new NotFoundException('Member not found in this workspace');
    }
    if (target.role === 'OWNER') {
      throw new ForbiddenException('Cannot change the OWNER role');
    }
    if (actorRole === 'ADMIN' && target.role === 'ADMIN') {
      throw new ForbiddenException('Admins cannot change another admin');
    }

    const updated = await this.prisma.workspaceMember.update({
      where: { id: target.id },
      data: { role: newRole },
    });
    return { userId: target.userId, role: updated.role };
  }

  async removeMember(
    workspaceId: string,
    actorRole: Role,
    targetUserId: string,
  ): Promise<void> {
    const target = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: targetUserId },
    });
    if (!target) {
      throw new NotFoundException('Member not found in this workspace');
    }
    if (target.role === 'OWNER') {
      throw new ForbiddenException('Cannot remove the OWNER');
    }
    if (actorRole === 'ADMIN' && target.role === 'ADMIN') {
      throw new ForbiddenException('Admins cannot remove another admin');
    }

    await this.prisma.workspaceMember.delete({ where: { id: target.id } });
    this.logger.log(`Member ${targetUserId} removed from workspace ${workspaceId}`);
  }

  // ----------------------------------------------
  // Membership lookup helpers (reused by guards)
  // ----------------------------------------------

  /**
   * Returns the membership row + workspace, or throws 404. The caller
   * is the only person who can ever see this workspace's data, so 404 is
   * intentionally returned when they're not a member (don't leak existence).
   */
  async requireMembership(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMember & { workspace: Workspace }> {
    const membership = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId },
      include: { workspace: true },
    });

    if (!membership || membership.workspace.deletedAt !== null) {
      throw new NotFoundException('Workspace not found');
    }
    return membership;
  }

  // ----------------------------------------------
  // Internal helpers
  // ----------------------------------------------

  private canManageWorkspace(role: Role): boolean {
    return role === 'OWNER' || role === 'ADMIN';
  }

  private slugify(input: string): string {
    return (
      input
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'workspace'
    );
  }

  private async resolveSlug(base: string): Promise<string> {
    let candidate = base;
    let attempt = 0;
    while (await this.prisma.workspace.findUnique({ where: { slug: candidate } })) {
      attempt += 1;
      candidate = attempt < 50 ? `${base}-${attempt}` : `${base}-${randomBytes(3).toString('hex')}`;
      if (attempt > 100) {
        throw new Error('Unable to generate unique workspace slug');
      }
    }
    return candidate;
  }
}
