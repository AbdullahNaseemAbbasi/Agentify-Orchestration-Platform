import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, Thread } from '@prisma/client';
import { PrismaService } from '@agentify/database';
import { CreateThreadDto } from './dto/create-thread.dto';
import { UpdateThreadDto } from './dto/update-thread.dto';

@Injectable()
export class ThreadsService {
  private readonly logger = new Logger(ThreadsService.name);

  constructor(private readonly prisma: PrismaService) {}

  findAll(workspaceId: string, agentId?: string): Promise<Thread[]> {
    return this.prisma.thread.findMany({
      where: { workspaceId, ...(agentId ? { agentId } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(workspaceId: string, id: string): Promise<Thread> {
    const thread = await this.prisma.thread.findFirst({
      where: { id, workspaceId },
    });
    if (!thread) {
      throw new NotFoundException('Thread not found');
    }
    return thread;
  }

  async create(workspaceId: string, dto: CreateThreadDto): Promise<Thread> {
    // Confirm the agent belongs to this workspace before creating the thread.
    const agent = await this.prisma.agent.findFirst({
      where: { id: dto.agentId, workspaceId, deletedAt: null },
    });
    if (!agent) {
      throw new NotFoundException('Agent not found in this workspace');
    }

    const thread = await this.prisma.thread.create({
      data: {
        workspaceId,
        agentId: dto.agentId,
        title: dto.title,
        externalId: dto.externalId,
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
      },
    });
    this.logger.log(`Created thread ${thread.id} for agent ${dto.agentId}`);
    return thread;
  }

  async update(workspaceId: string, id: string, dto: UpdateThreadDto): Promise<Thread> {
    await this.findById(workspaceId, id);
    return this.prisma.thread.update({
      where: { id },
      data: {
        title: dto.title,
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async delete(workspaceId: string, id: string): Promise<void> {
    await this.findById(workspaceId, id);
    await this.prisma.thread.delete({ where: { id } });
    this.logger.log(`Deleted thread ${id}`);
  }
}
