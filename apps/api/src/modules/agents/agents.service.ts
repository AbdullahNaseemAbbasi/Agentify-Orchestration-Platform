import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Agent, Prisma } from '@prisma/client';
import { PrismaService } from '@agentify/database';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';

@Injectable()
export class AgentsService {
  private readonly logger = new Logger(AgentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  findAll(workspaceId: string): Promise<Agent[]> {
    return this.prisma.agent.findMany({
      where: { workspaceId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(workspaceId: string, id: string): Promise<Agent> {
    const agent = await this.prisma.agent.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });
    if (!agent) {
      throw new NotFoundException('Agent not found');
    }
    return agent;
  }

  async create(workspaceId: string, createdById: string, dto: CreateAgentDto): Promise<Agent> {
    const data: Prisma.AgentCreateInput = {
      name: dto.name,
      description: dto.description,
      systemPrompt: dto.systemPrompt,
      model: dto.model,
      provider: dto.provider,
      temperature: dto.temperature,
      maxTokens: dto.maxTokens,
      topP: dto.topP,
      responseFormat: dto.responseFormat as Prisma.InputJsonValue,
      toolChoice: dto.toolChoice,
      maxSteps: dto.maxSteps,
      isActive: dto.isActive,
      createdById,
      workspace: { connect: { id: workspaceId } },
    };

    const agent = await this.prisma.agent.create({ data });
    this.logger.log(`Created agent ${agent.id} (${agent.name}) in workspace ${workspaceId}`);
    return agent;
  }

  async update(workspaceId: string, id: string, dto: UpdateAgentDto): Promise<Agent> {
    await this.findById(workspaceId, id); // ensures workspace ownership + 404 if missing

    return this.prisma.agent.update({
      where: { id },
      data: {
        ...dto,
        responseFormat: dto.responseFormat as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async softDelete(workspaceId: string, id: string): Promise<void> {
    await this.findById(workspaceId, id);
    await this.prisma.agent.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    this.logger.log(`Soft-deleted agent ${id}`);
  }
}
