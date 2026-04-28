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
import { Tool } from '@prisma/client';
import { CurrentWorkspace } from '../../common/decorators/current-workspace.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { WorkspaceContext, WorkspaceGuard } from '../../common/guards/workspace.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateToolDto } from './dto/create-tool.dto';
import { UpdateToolDto } from './dto/update-tool.dto';
import { ToolsService } from './tools.service';

@Controller('tools')
@UseGuards(JwtAuthGuard, WorkspaceGuard, RolesGuard)
export class ToolsController {
  constructor(private readonly toolsService: ToolsService) {}

  @Get()
  findAll(@CurrentWorkspace() ws: WorkspaceContext): Promise<Tool[]> {
    return this.toolsService.findAll(ws.id);
  }

  @Get(':id')
  findOne(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<Tool> {
    return this.toolsService.findById(ws.id, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('OWNER', 'ADMIN', 'MEMBER')
  create(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Body() dto: CreateToolDto,
  ): Promise<Tool> {
    return this.toolsService.create(ws.id, dto);
  }

  @Patch(':id')
  @Roles('OWNER', 'ADMIN', 'MEMBER')
  update(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateToolDto,
  ): Promise<Tool> {
    return this.toolsService.update(ws.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('OWNER', 'ADMIN')
  async remove(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<void> {
    await this.toolsService.delete(ws.id, id);
  }
}
