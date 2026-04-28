import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '@agentify/database';
import { EmbeddingsModule } from '@agentify/embeddings';
import { QueueModule } from '@agentify/queue';
import { DocumentProcessor } from './processors/document.processor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true }),
    DatabaseModule,
    EmbeddingsModule,
    QueueModule.forRoot(),
    QueueModule.registerQueues('DOCUMENT_PROCESSING'),
  ],
  providers: [DocumentProcessor],
})
export class WorkerModule {}
