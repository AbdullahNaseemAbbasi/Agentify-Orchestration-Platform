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
import { KnowledgeBase } from '@prisma/client';
import { CurrentWorkspace } from '../../common/decorators/current-workspace.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { WorkspaceContext, WorkspaceGuard } from '../../common/guards/workspace.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateKnowledgeBaseDto } from './dto/create-knowledge-base.dto';
import { UpdateKnowledgeBaseDto } from './dto/update-knowledge-base.dto';
import { KnowledgeBasesService } from './knowledge-bases.service';

@Controller('knowledge-bases')
@UseGuards(JwtAuthGuard, WorkspaceGuard, RolesGuard)
export class KnowledgeBasesController {
  constructor(private readonly kbService: KnowledgeBasesService) {}

  @Get()
  findAll(@CurrentWorkspace() ws: WorkspaceContext): Promise<KnowledgeBase[]> {
    return this.kbService.findAll(ws.id);
  }

  @Get(':id')
  findOne(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<KnowledgeBase> {
    return this.kbService.findById(ws.id, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('OWNER', 'ADMIN', 'MEMBER')
  create(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Body() dto: CreateKnowledgeBaseDto,
  ): Promise<KnowledgeBase> {
    return this.kbService.create(ws.id, dto);
  }

  @Patch(':id')
  @Roles('OWNER', 'ADMIN', 'MEMBER')
  update(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateKnowledgeBaseDto,
  ): Promise<KnowledgeBase> {
    return this.kbService.update(ws.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('OWNER', 'ADMIN')
  async remove(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<void> {
    await this.kbService.delete(ws.id, id);
  }
}
