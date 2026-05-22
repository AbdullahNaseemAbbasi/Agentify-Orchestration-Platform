import { Module } from '@nestjs/common';
import { RuntimeModule } from '@agentify/runtime';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { RunsController } from './runs.controller';

@Module({
  imports: [
    WorkspacesModule, // for WorkspaceGuard
    RuntimeModule, // RunsService — the agent runtime engine
  ],
  controllers: [RunsController],
})
export class RunsModule {}
