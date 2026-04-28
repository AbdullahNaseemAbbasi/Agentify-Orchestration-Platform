import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Document } from '@prisma/client';
import { CurrentWorkspace } from '../../common/decorators/current-workspace.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { WorkspaceContext, WorkspaceGuard } from '../../common/guards/workspace.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DocumentsService } from './documents.service';
import { CreateTextDocumentDto } from './dto/create-text-document.dto';

@Controller('knowledge-bases/:kbId/documents')
@UseGuards(JwtAuthGuard, WorkspaceGuard, RolesGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  findAll(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('kbId', new ParseUUIDPipe({ version: '4' })) kbId: string,
  ): Promise<Document[]> {
    return this.documentsService.findAll(ws.id, kbId);
  }

  @Get(':id')
  findOne(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('kbId', new ParseUUIDPipe({ version: '4' })) kbId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<Document> {
    return this.documentsService.findById(ws.id, kbId, id);
  }

  @Post('text')
  @HttpCode(HttpStatus.CREATED)
  @Roles('OWNER', 'ADMIN', 'MEMBER')
  createText(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('kbId', new ParseUUIDPipe({ version: '4' })) kbId: string,
    @Body() dto: CreateTextDocumentDto,
  ): Promise<Document> {
    return this.documentsService.createText(ws.id, kbId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('OWNER', 'ADMIN', 'MEMBER')
  async remove(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('kbId', new ParseUUIDPipe({ version: '4' })) kbId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<void> {
    await this.documentsService.delete(ws.id, kbId, id);
  }
}
