import { Module } from '@nestjs/common';
import { QueueModule } from '@agentify/queue';
import { RuntimeModule } from '@agentify/runtime';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { AsyncRunsService } from './async-runs.service';
import { RunsController } from './runs.controller';

@Module({
  imports: [
    WorkspacesModule, // for WorkspaceGuard
    RuntimeModule, // RunsService — the agent runtime engine
    QueueModule.registerQueues('AGENT_RUN'), // async-run producer
  ],
  controllers: [RunsController],
  providers: [AsyncRunsService],
})
export class RunsModule {}
