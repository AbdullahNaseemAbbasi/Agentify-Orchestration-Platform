import { Module } from '@nestjs/common';
import { RuntimeModule } from '@agentify/runtime';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { KnowledgeBasesController } from './knowledge-bases.controller';
import { KnowledgeBasesService } from './knowledge-bases.service';

@Module({
  imports: [WorkspacesModule, RuntimeModule], // RuntimeModule provides SearchService
  controllers: [KnowledgeBasesController],
  providers: [KnowledgeBasesService],
  exports: [KnowledgeBasesService],
})
export class KnowledgeBasesModule {}
