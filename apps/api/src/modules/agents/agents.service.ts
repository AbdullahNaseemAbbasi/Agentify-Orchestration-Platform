import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Agent, KnowledgeBase, Prisma, Tool } from '@prisma/client';
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

  // ----------------------------------------------
  // Agent-Tool attachments
  // ----------------------------------------------

  async listTools(workspaceId: string, agentId: string): Promise<Tool[]> {
    await this.findById(workspaceId, agentId);
    const rows = await this.prisma.agentTool.findMany({
      where: { agentId },
      include: { tool: true },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => r.tool);
  }

  async attachTool(workspaceId: string, agentId: string, toolId: string): Promise<Tool> {
    await this.findById(workspaceId, agentId);

    const tool = await this.prisma.tool.findFirst({
      where: { id: toolId, workspaceId },
    });
    if (!tool) {
      throw new NotFoundException('Tool not found in this workspace');
    }

    try {
      await this.prisma.agentTool.create({ data: { agentId, toolId } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Tool already attached to this agent');
      }
      throw err;
    }

    this.logger.log(`Attached tool ${toolId} to agent ${agentId}`);
    return tool;
  }

  async detachTool(workspaceId: string, agentId: string, toolId: string): Promise<void> {
    await this.findById(workspaceId, agentId);

    const result = await this.prisma.agentTool.deleteMany({
      where: { agentId, toolId },
    });
    if (result.count === 0) {
      throw new NotFoundException('Tool was not attached to this agent');
    }
    this.logger.log(`Detached tool ${toolId} from agent ${agentId}`);
  }

  // ----------------------------------------------
  // Agent-KnowledgeBase attachments
  // ----------------------------------------------

  async listKnowledgeBases(
    workspaceId: string,
    agentId: string,
  ): Promise<Array<KnowledgeBase & { topK: number; minSimilarity: number }>> {
    await this.findById(workspaceId, agentId);
    const rows = await this.prisma.agentKnowledgeBase.findMany({
      where: { agentId },
      include: { knowledgeBase: true },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => ({
      ...r.knowledgeBase,
      topK: r.topK,
      minSimilarity: r.minSimilarity,
    }));
  }

  async attachKnowledgeBase(
    workspaceId: string,
    agentId: string,
    kbId: string,
    topK?: number,
    minSimilarity?: number,
  ): Promise<KnowledgeBase> {
    await this.findById(workspaceId, agentId);

    const kb = await this.prisma.knowledgeBase.findFirst({
      where: { id: kbId, workspaceId },
    });
    if (!kb) {
      throw new NotFoundException('Knowledge base not found in this workspace');
    }

    try {
      await this.prisma.agentKnowledgeBase.create({
        data: { agentId, knowledgeBaseId: kbId, topK, minSimilarity },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Knowledge base already attached to this agent');
      }
      throw err;
    }

    this.logger.log(`Attached KB ${kbId} to agent ${agentId}`);
    return kb;
  }

  async detachKnowledgeBase(workspaceId: string, agentId: string, kbId: string): Promise<void> {
    await this.findById(workspaceId, agentId);

    const result = await this.prisma.agentKnowledgeBase.deleteMany({
      where: { agentId, knowledgeBaseId: kbId },
    });
    if (result.count === 0) {
      throw new NotFoundException('Knowledge base was not attached to this agent');
    }
    this.logger.log(`Detached KB ${kbId} from agent ${agentId}`);
  }
}
