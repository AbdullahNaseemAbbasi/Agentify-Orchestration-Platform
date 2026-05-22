import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@agentify/cache';
import { DatabaseModule } from '@agentify/database';
import { EmbeddingsModule } from '@agentify/embeddings';
import { LlmModule } from '@agentify/llm';
import { QueueModule } from '@agentify/queue';
import { RuntimeModule } from '@agentify/runtime';
import { AgentRunProcessor } from './processors/agent-run.processor';
import { DocumentProcessor } from './processors/document.processor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true }),
    DatabaseModule,
    CacheModule, // RedisService — cancellation flags
    EmbeddingsModule,
    LlmModule, // LLM providers for the runtime engine
    RuntimeModule, // RunsService — runs the agent reasoning loop
    QueueModule.forRoot(),
    QueueModule.registerQueues('DOCUMENT_PROCESSING', 'AGENT_RUN'),
  ],
  providers: [DocumentProcessor, AgentRunProcessor],
})
export class WorkerModule {}
