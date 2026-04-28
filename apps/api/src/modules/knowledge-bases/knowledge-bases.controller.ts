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
import { SearchDto } from './dto/search.dto';
import { UpdateKnowledgeBaseDto } from './dto/update-knowledge-base.dto';
import { KnowledgeBasesService } from './knowledge-bases.service';
import { SearchHit, SearchService } from './search.service';

@Controller('knowledge-bases')
@UseGuards(JwtAuthGuard, WorkspaceGuard, RolesGuard)
export class KnowledgeBasesController {
  constructor(
    private readonly kbService: KnowledgeBasesService,
    private readonly searchService: SearchService,
  ) {}

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

  // ----- Vector search -----

  @Post(':id/search')
  @HttpCode(HttpStatus.OK)
  search(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: SearchDto,
  ): Promise<SearchHit[]> {
    return this.searchService.searchSimilar(
      ws.id,
      id,
      dto.query,
      dto.topK,
      dto.minSimilarity,
    );
  }
}
