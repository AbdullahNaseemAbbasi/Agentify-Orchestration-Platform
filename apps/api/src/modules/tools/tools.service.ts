import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Tool, ToolType } from '@prisma/client';
import { PrismaService } from '@agentify/database';
import { CreateToolDto } from './dto/create-tool.dto';
import { UpdateToolDto } from './dto/update-tool.dto';

@Injectable()
export class ToolsService {
  private readonly logger = new Logger(ToolsService.name);

  constructor(private readonly prisma: PrismaService) {}

  findAll(workspaceId: string): Promise<Tool[]> {
    return this.prisma.tool.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(workspaceId: string, id: string): Promise<Tool> {
    const tool = await this.prisma.tool.findFirst({
      where: { id, workspaceId },
    });
    if (!tool) {
      throw new NotFoundException('Tool not found');
    }
    return tool;
  }

  async create(workspaceId: string, dto: CreateToolDto): Promise<Tool> {
    this.validateShape(dto.type ?? 'HTTP', dto);

    try {
      const tool = await this.prisma.tool.create({
        data: {
          workspaceId,
          name: dto.name,
          description: dto.description,
          parameters: dto.parameters as Prisma.InputJsonValue,
          type: dto.type ?? 'HTTP',
          httpMethod: dto.httpMethod?.toUpperCase(),
          httpUrl: dto.httpUrl,
          httpHeaders: dto.httpHeaders as Prisma.InputJsonValue | undefined,
          httpBody: dto.httpBody as Prisma.InputJsonValue | undefined,
          httpAuthType: dto.httpAuthType,
          httpAuthValue: dto.httpAuthValue,
          builtInType: dto.builtInType,
          mcpServerUrl: dto.mcpServerUrl,
          timeoutMs: dto.timeoutMs,
        },
      });
      this.logger.log(`Created tool ${tool.id} (${tool.name}) in workspace ${workspaceId}`);
      return tool;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException(`A tool named "${dto.name}" already exists in this workspace`);
      }
      throw err;
    }
  }

  async update(workspaceId: string, id: string, dto: UpdateToolDto): Promise<Tool> {
    const existing = await this.findById(workspaceId, id);
    const nextType = dto.type ?? existing.type;
    this.validateShape(nextType, { ...existing, ...dto });

    try {
      return await this.prisma.tool.update({
        where: { id },
        data: {
          ...dto,
          httpMethod: dto.httpMethod ? dto.httpMethod.toUpperCase() : undefined,
          parameters: dto.parameters as Prisma.InputJsonValue | undefined,
          httpHeaders: dto.httpHeaders as Prisma.InputJsonValue | undefined,
          httpBody: dto.httpBody as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException(`A tool named "${dto.name}" already exists in this workspace`);
      }
      throw err;
    }
  }

  async delete(workspaceId: string, id: string): Promise<void> {
    await this.findById(workspaceId, id);
    await this.prisma.tool.delete({ where: { id } });
    this.logger.log(`Deleted tool ${id} from workspace ${workspaceId}`);
  }

  // ----------------------------------------------
  // Shape validation per tool type
  // ----------------------------------------------

  private validateShape(type: ToolType, dto: Partial<Tool & CreateToolDto>): void {
    if (type === 'HTTP') {
      if (!dto.httpMethod || !dto.httpUrl) {
        throw new BadRequestException('HTTP tools require both httpMethod and httpUrl');
      }
    }
    if (type === 'BUILT_IN' && !dto.builtInType) {
      throw new BadRequestException('BUILT_IN tools require builtInType');
    }
    if (type === 'MCP' && !dto.mcpServerUrl) {
      throw new BadRequestException('MCP tools require mcpServerUrl');
    }
    if (
      typeof dto.parameters !== 'object' ||
      dto.parameters === null ||
      Array.isArray(dto.parameters) ||
      (dto.parameters as Record<string, unknown>).type !== 'object'
    ) {
      throw new BadRequestException('parameters must be a JSON Schema object with type: "object"');
    }
  }
}
