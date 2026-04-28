import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentWorkspace } from '../../common/decorators/current-workspace.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { WorkspaceContext, WorkspaceGuard } from '../../common/guards/workspace.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtUser } from '../auth/strategies/jwt.strategy';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { WorkspaceWithRole, WorkspacesService } from './workspaces.service';

@Controller('workspaces')
@UseGuards(JwtAuthGuard)
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  // ---------- Workspace CRUD (caller-scoped) ----------

  @Get()
  findAll(@CurrentUser() user: JwtUser): Promise<WorkspaceWithRole[]> {
    return this.workspacesService.findAllForUser(user.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateWorkspaceDto,
  ): Promise<WorkspaceWithRole> {
    return this.workspacesService.create(dto, user.id);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: JwtUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<WorkspaceWithRole> {
    return this.workspacesService.findByIdForUser(id, user.id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateWorkspaceDto,
  ): Promise<WorkspaceWithRole> {
    return this.workspacesService.update(id, user.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: JwtUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<void> {
    await this.workspacesService.softDelete(id, user.id);
  }

  // ---------- Members ----------

  @Get(':workspaceId/members')
  @UseGuards(WorkspaceGuard)
  listMembers(
    @CurrentWorkspace() ws: WorkspaceContext,
  ): Promise<
    Array<{ userId: string; role: Role; joinedAt: Date; email: string; name: string }>
  > {
    return this.workspacesService.listMembers(ws.id);
  }

  @Post(':workspaceId/members')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(WorkspaceGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  inviteMember(
    @CurrentUser() user: JwtUser,
    @CurrentWorkspace() ws: WorkspaceContext,
    @Body() dto: InviteMemberDto,
  ): Promise<{ userId: string; role: Role }> {
    return this.workspacesService.inviteMember(ws.id, user.id, dto.email, dto.role);
  }

  @Patch(':workspaceId/members/:userId')
  @UseGuards(WorkspaceGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  updateMember(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('userId', new ParseUUIDPipe({ version: '4' })) targetUserId: string,
    @Body() dto: UpdateMemberDto,
  ): Promise<{ userId: string; role: Role }> {
    return this.workspacesService.updateMemberRole(ws.id, ws.role, targetUserId, dto.role);
  }

  @Delete(':workspaceId/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(WorkspaceGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  async removeMember(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('userId', new ParseUUIDPipe({ version: '4' })) targetUserId: string,
  ): Promise<void> {
    await this.workspacesService.removeMember(ws.id, ws.role, targetUserId);
  }
}
