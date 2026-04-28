import { Module } from '@nestjs/common';
import { KnowledgeBasesModule } from '../knowledge-bases/knowledge-bases.module';
import { ToolsModule } from '../tools/tools.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { RunsService } from './runs.service';

@Module({
  imports: [
    WorkspacesModule, // for WorkspaceGuard once a controller is added (Phase D)
    ToolsModule, // for HttpToolExecutor
    KnowledgeBasesModule, // for SearchService
  ],
  providers: [RunsService],
  exports: [RunsService],
})
export class RunsModule {}
