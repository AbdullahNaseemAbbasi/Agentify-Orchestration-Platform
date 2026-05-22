import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AGENT_RUN_JOB_NAME, AgentRunJob, QUEUE_NAMES } from '@agentify/queue';
import { RunsService } from '@agentify/runtime';

/**
 * Consumes the `agent-run` queue: drives a previously-queued run
 * through the agent reasoning loop here in the worker process —
 * separate from the API for isolation (spec §4).
 */
@Processor(QUEUE_NAMES.AGENT_RUN)
export class AgentRunProcessor extends WorkerHost {
  private readonly logger = new Logger(AgentRunProcessor.name);

  constructor(private readonly runsService: RunsService) {
    super();
  }

  async process(job: Job<AgentRunJob>): Promise<void> {
    if (job.name !== AGENT_RUN_JOB_NAME) {
      this.logger.warn(`Skipping unknown job name: ${job.name}`);
      return;
    }
    const { runId, userInput } = job.data;
    this.logger.log(`Executing queued run ${runId}`);
    await this.runsService.runQueued(runId, userInput);
    this.logger.log(`Queued run ${runId} finished`);
  }
}
