import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Run } from '@prisma/client';
import { Queue } from 'bullmq';
import { AGENT_RUN_JOB_NAME, AgentRunJob, QUEUE_NAMES } from '@agentify/queue';
import { RunsService } from '@agentify/runtime';

/** Result of enqueueing an async run — the PENDING run plus a marker. */
export interface QueuedRunResult {
  run: Run;
  queued: true;
}

/**
 * Producer side of asynchronous runs. Creates the PENDING Run via the
 * runtime engine, then drops a job on the agent-run queue for a worker
 * to execute. Lives in the API (not libs/runtime) so the runtime stays
 * free of any BullMQ dependency.
 */
@Injectable()
export class AsyncRunsService {
  private readonly logger = new Logger(AsyncRunsService.name);

  constructor(
    private readonly runsService: RunsService,
    @InjectQueue(QUEUE_NAMES.AGENT_RUN)
    private readonly queue: Queue<AgentRunJob>,
  ) {}

  async enqueue(
    workspaceId: string,
    agentId: string,
    threadId: string | undefined,
    userInput: string,
  ): Promise<QueuedRunResult> {
    const run = await this.runsService.createQueuedRun(workspaceId, agentId, threadId, userInput);
    await this.queue.add(
      AGENT_RUN_JOB_NAME,
      { runId: run.id, workspaceId, userInput },
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
    );
    this.logger.log(`Queued run ${run.id} for async execution`);
    return { run, queued: true };
  }
}
