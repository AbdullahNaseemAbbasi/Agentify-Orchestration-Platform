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
  Query,
  UseGuards,
} from '@nestjs/common';
import { Thread } from '@prisma/client';
import { CurrentWorkspace } from '../../common/decorators/current-workspace.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { WorkspaceContext, WorkspaceGuard } from '../../common/guards/workspace.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateThreadDto } from './dto/create-thread.dto';
import { UpdateThreadDto } from './dto/update-thread.dto';
import { ThreadsService } from './threads.service';

@Controller('threads')
@UseGuards(JwtAuthGuard, WorkspaceGuard, RolesGuard)
export class ThreadsController {
  constructor(private readonly threadsService: ThreadsService) {}

  @Get()
  findAll(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Query('agentId') agentId?: string,
  ): Promise<Thread[]> {
    return this.threadsService.findAll(ws.id, agentId);
  }

  @Get(':id')
  findOne(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<Thread> {
    return this.threadsService.findById(ws.id, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('OWNER', 'ADMIN', 'MEMBER')
  create(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Body() dto: CreateThreadDto,
  ): Promise<Thread> {
    return this.threadsService.create(ws.id, dto);
  }

  @Patch(':id')
  @Roles('OWNER', 'ADMIN', 'MEMBER')
  update(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateThreadDto,
  ): Promise<Thread> {
    return this.threadsService.update(ws.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('OWNER', 'ADMIN', 'MEMBER')
  async remove(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<void> {
    await this.threadsService.delete(ws.id, id);
  }
}
