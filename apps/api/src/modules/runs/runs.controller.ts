import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Run } from '@prisma/client';
import { CurrentWorkspace } from '../../common/decorators/current-workspace.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { WorkspaceContext, WorkspaceGuard } from '../../common/guards/workspace.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateRunDto } from './dto/create-run.dto';
import { ExecuteRunResult, RunsService } from './runs.service';

@Controller()
@UseGuards(JwtAuthGuard, WorkspaceGuard, RolesGuard)
export class RunsController {
  constructor(private readonly runsService: RunsService) {}

  /**
   * Synchronous run: blocks until the reasoning loop returns a final
   * message or hits maxSteps. Streaming + async runs land in Week 9.
   */
  @Post('agents/:agentId/runs')
  @HttpCode(HttpStatus.OK)
  @Roles('OWNER', 'ADMIN', 'MEMBER')
  execute(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('agentId', new ParseUUIDPipe({ version: '4' })) agentId: string,
    @Body() dto: CreateRunDto,
  ): Promise<ExecuteRunResult> {
    return this.runsService.execute(ws.id, agentId, dto.threadId, dto.input);
  }

  @Get('runs/:id')
  findOne(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<Run> {
    return this.runsService.findById(ws.id, id);
  }
}
