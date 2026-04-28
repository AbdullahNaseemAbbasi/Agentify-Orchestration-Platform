import { Module } from '@nestjs/common';
import { KnowledgeBasesModule } from '../knowledge-bases/knowledge-bases.module';
import { ToolsModule } from '../tools/tools.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { RunsController } from './runs.controller';
import { RunsService } from './runs.service';

@Module({
  imports: [
    WorkspacesModule, // for WorkspaceGuard
    ToolsModule, // for HttpToolExecutor
    KnowledgeBasesModule, // for SearchService
  ],
  controllers: [RunsController],
  providers: [RunsService],
  exports: [RunsService],
})
export class RunsModule {}
