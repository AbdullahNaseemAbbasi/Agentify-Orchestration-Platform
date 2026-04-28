import { Module } from '@nestjs/common';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { HttpToolExecutor } from './http-tool.executor';
import { ToolsController } from './tools.controller';
import { ToolsService } from './tools.service';

@Module({
  imports: [WorkspacesModule],
  controllers: [ToolsController],
  providers: [ToolsService, HttpToolExecutor],
  exports: [ToolsService, HttpToolExecutor],
})
export class ToolsModule {}
