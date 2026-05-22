import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Run } from '@prisma/client';
import { Response } from 'express';
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

  /**
   * Streaming run over Server-Sent Events. Holds the HTTP response open
   * and writes one `event:`/`data:` block per reasoning-loop event, so
   * the client sees the answer typed out in real time.
   *
   * `@Res()` puts the handler in library-specific mode — we own the
   * response lifecycle and must end it ourselves.
   */
  @Post('agents/:agentId/runs/stream')
  @Roles('OWNER', 'ADMIN', 'MEMBER')
  async stream(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('agentId', new ParseUUIDPipe({ version: '4' })) agentId: string,
    @Body() dto: CreateRunDto,
    @Res() res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    // Tell Nginx and friends not to buffer — otherwise deltas arrive in bursts.
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Stop doing work the moment the client hangs up.
    let clientGone = false;
    res.on('close', () => {
      clientGone = true;
    });

    try {
      for await (const ev of this.runsService.executeStream(
        ws.id,
        agentId,
        dto.threadId,
        dto.input,
      )) {
        if (clientGone) break;
        res.write(`event: ${ev.event}\n`);
        res.write(`data: ${JSON.stringify(ev.data)}\n\n`);
      }
    } finally {
      res.end();
    }
  }

  @Get('runs/:id')
  findOne(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<Run> {
    return this.runsService.findById(ws.id, id);
  }
}
