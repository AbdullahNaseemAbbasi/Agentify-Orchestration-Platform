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
import { Agent, KnowledgeBase, Tool } from '@prisma/client';
import { CurrentWorkspace } from '../../common/decorators/current-workspace.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { WorkspaceContext, WorkspaceGuard } from '../../common/guards/workspace.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtUser } from '../auth/strategies/jwt.strategy';
import { AttachKnowledgeBaseDto } from '../knowledge-bases/dto/attach-knowledge-base.dto';
import { AgentsService } from './agents.service';
import { AttachToolDto } from './dto/attach-tool.dto';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';

@Controller('agents')
@UseGuards(JwtAuthGuard, WorkspaceGuard, RolesGuard)
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Get()
  findAll(@CurrentWorkspace() ws: WorkspaceContext): Promise<Agent[]> {
    return this.agentsService.findAll(ws.id);
  }

  @Get(':id')
  findOne(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<Agent> {
    return this.agentsService.findById(ws.id, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('OWNER', 'ADMIN', 'MEMBER')
  create(
    @CurrentWorkspace() ws: WorkspaceContext,
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateAgentDto,
  ): Promise<Agent> {
    return this.agentsService.create(ws.id, user.id, dto);
  }

  @Patch(':id')
  @Roles('OWNER', 'ADMIN', 'MEMBER')
  update(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateAgentDto,
  ): Promise<Agent> {
    return this.agentsService.update(ws.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('OWNER', 'ADMIN', 'MEMBER')
  async remove(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<void> {
    await this.agentsService.softDelete(ws.id, id);
  }

  // ----- Agent-Tool attachments -----

  @Get(':id/tools')
  listTools(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<Tool[]> {
    return this.agentsService.listTools(ws.id, id);
  }

  @Post(':id/tools')
  @HttpCode(HttpStatus.CREATED)
  @Roles('OWNER', 'ADMIN', 'MEMBER')
  attachTool(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: AttachToolDto,
  ): Promise<Tool> {
    return this.agentsService.attachTool(ws.id, id, dto.toolId);
  }

  @Delete(':id/tools/:toolId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('OWNER', 'ADMIN', 'MEMBER')
  async detachTool(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('toolId', new ParseUUIDPipe({ version: '4' })) toolId: string,
  ): Promise<void> {
    await this.agentsService.detachTool(ws.id, id, toolId);
  }

  // ----- Agent-KnowledgeBase attachments -----

  @Get(':id/knowledge-bases')
  listKnowledgeBases(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<Array<KnowledgeBase & { topK: number; minSimilarity: number }>> {
    return this.agentsService.listKnowledgeBases(ws.id, id);
  }

  @Post(':id/knowledge-bases')
  @HttpCode(HttpStatus.CREATED)
  @Roles('OWNER', 'ADMIN', 'MEMBER')
  attachKnowledgeBase(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: AttachKnowledgeBaseDto,
  ): Promise<KnowledgeBase> {
    return this.agentsService.attachKnowledgeBase(
      ws.id,
      id,
      dto.knowledgeBaseId,
      dto.topK,
      dto.minSimilarity,
    );
  }

  @Delete(':id/knowledge-bases/:kbId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('OWNER', 'ADMIN', 'MEMBER')
  async detachKnowledgeBase(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('kbId', new ParseUUIDPipe({ version: '4' })) kbId: string,
  ): Promise<void> {
    await this.agentsService.detachKnowledgeBase(ws.id, id, kbId);
  }
}
