import { Injectable, NotFoundException } from '@nestjs/common';
import { Message } from '@prisma/client';
import { PrismaService } from '@agentify/database';

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List all messages of a thread (oldest first). Workspace ownership is
   * verified via the parent thread.
   */
  async findAllForThread(workspaceId: string, threadId: string): Promise<Message[]> {
    const thread = await this.prisma.thread.findFirst({
      where: { id: threadId, workspaceId },
    });
    if (!thread) {
      throw new NotFoundException('Thread not found');
    }

    return this.prisma.message.findMany({
      where: { threadId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
