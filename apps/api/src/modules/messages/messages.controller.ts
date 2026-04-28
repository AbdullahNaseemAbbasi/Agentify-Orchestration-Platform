import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { Message } from '@prisma/client';
import { CurrentWorkspace } from '../../common/decorators/current-workspace.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { WorkspaceContext, WorkspaceGuard } from '../../common/guards/workspace.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MessagesService } from './messages.service';

@Controller('threads/:threadId/messages')
@UseGuards(JwtAuthGuard, WorkspaceGuard, RolesGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  findAll(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('threadId', new ParseUUIDPipe({ version: '4' })) threadId: string,
  ): Promise<Message[]> {
    return this.messagesService.findAllForThread(ws.id, threadId);
  }
}
