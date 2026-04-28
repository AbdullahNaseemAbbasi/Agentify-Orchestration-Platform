import { Module } from '@nestjs/common';
import { EmbeddingsModule } from '@agentify/embeddings';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { KnowledgeBasesController } from './knowledge-bases.controller';
import { KnowledgeBasesService } from './knowledge-bases.service';
import { SearchService } from './search.service';

@Module({
  imports: [WorkspacesModule, EmbeddingsModule],
  controllers: [KnowledgeBasesController],
  providers: [KnowledgeBasesService, SearchService],
  exports: [KnowledgeBasesService, SearchService],
})
export class KnowledgeBasesModule {}
