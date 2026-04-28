import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '@agentify/database';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { EmbeddingsModule } from '@agentify/embeddings';
import { QueueModule } from '@agentify/queue';
import { AgentsModule } from './modules/agents/agents.module';
import { AuthModule } from './modules/auth/auth.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { KnowledgeBasesModule } from './modules/knowledge-bases/knowledge-bases.module';
import { MessagesModule } from './modules/messages/messages.module';
import { ThreadsModule } from './modules/threads/threads.module';
import { ToolsModule } from './modules/tools/tools.module';
import { UsersModule } from './modules/users/users.module';
import { WorkspacesModule } from './modules/workspaces/workspaces.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true }),
    DatabaseModule,
    EmbeddingsModule,
    QueueModule.forRoot(),
    HealthModule,
    UsersModule,
    AuthModule,
    WorkspacesModule,
    AgentsModule,
    ToolsModule,
    KnowledgeBasesModule,
    DocumentsModule,
    ThreadsModule,
    MessagesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
