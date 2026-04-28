import { Module } from '@nestjs/common';
import { QueueModule } from '@agentify/queue';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

@Module({
  imports: [
    WorkspacesModule,
    QueueModule.registerQueues('DOCUMENT_PROCESSING'),
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
