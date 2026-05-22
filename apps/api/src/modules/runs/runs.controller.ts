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
import { ExecuteRunResult, RunsService } from '@agentify/runtime';
import { AsyncRunsService, QueuedRunResult } from './async-runs.service';
import { CreateRunDto } from './dto/create-run.dto';

@Controller()
@UseGuards(JwtAuthGuard, WorkspaceGuard, RolesGuard)
export class RunsController {
  constructor(
    private readonly runsService: RunsService,
    private readonly asyncRuns: AsyncRunsService,
  ) {}

  /**
   * Run an agent. By default this is synchronous — it blocks until the
   * reasoning loop returns a final message or hits maxSteps. With
   * `async: true` the run is queued instead: a PENDING run is returned
   * immediately and a worker executes it; poll `GET /runs/:id`.
   */
  @Post('agents/:agentId/runs')
  @HttpCode(HttpStatus.OK)
  @Roles('OWNER', 'ADMIN', 'MEMBER')
  execute(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('agentId', new ParseUUIDPipe({ version: '4' })) agentId: string,
    @Body() dto: CreateRunDto,
  ): Promise<ExecuteRunResult | QueuedRunResult> {
    if (dto.async) {
      return this.asyncRuns.enqueue(ws.id, agentId, dto.threadId, dto.input);
    }
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

    // If the client hangs up, ask the run to cancel itself. We do NOT
    // break the loop — the run finishes its current step, sees the
    // cancel flag, and marks itself CANCELLED cleanly. We just stop
    // writing to the dead socket.
    let clientGone = false;
    let runId: string | undefined;
    res.on('close', () => {
      clientGone = true;
      if (runId) {
        void this.runsService.requestCancel(ws.id, runId).catch(() => undefined);
      }
    });

    try {
      for await (const ev of this.runsService.executeStream(
        ws.id,
        agentId,
        dto.threadId,
        dto.input,
      )) {
        if (ev.event === 'run.created' && typeof ev.data.run_id === 'string') {
          runId = ev.data.run_id;
        }
        if (!clientGone) {
          res.write(`event: ${ev.event}\n`);
          res.write(`data: ${JSON.stringify(ev.data)}\n\n`);
        }
      }
    } finally {
      if (!clientGone) res.end();
    }
  }

  /**
   * Request cancellation of an in-flight run. Idempotent — a no-op when
   * the run has already reached a terminal state. The run flips to
   * CANCELLED the next time its reasoning loop polls the flag.
   */
  @Post('runs/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @Roles('OWNER', 'ADMIN', 'MEMBER')
  cancel(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<Run> {
    return this.runsService.requestCancel(ws.id, id);
  }

  @Get('runs/:id')
  findOne(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<Run> {
    return this.runsService.findById(ws.id, id);
  }
}
