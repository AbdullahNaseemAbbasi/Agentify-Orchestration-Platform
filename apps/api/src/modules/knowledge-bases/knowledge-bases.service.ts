import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { KnowledgeBase } from '@prisma/client';
import { PrismaService } from '@agentify/database';
import { CreateKnowledgeBaseDto } from './dto/create-knowledge-base.dto';
import { UpdateKnowledgeBaseDto } from './dto/update-knowledge-base.dto';

@Injectable()
export class KnowledgeBasesService {
  private readonly logger = new Logger(KnowledgeBasesService.name);

  constructor(private readonly prisma: PrismaService) {}

  findAll(workspaceId: string): Promise<KnowledgeBase[]> {
    return this.prisma.knowledgeBase.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(workspaceId: string, id: string): Promise<KnowledgeBase> {
    const kb = await this.prisma.knowledgeBase.findFirst({
      where: { id, workspaceId },
    });
    if (!kb) {
      throw new NotFoundException('Knowledge base not found');
    }
    return kb;
  }

  async create(workspaceId: string, dto: CreateKnowledgeBaseDto): Promise<KnowledgeBase> {
    if (
      dto.chunkSize !== undefined &&
      dto.chunkOverlap !== undefined &&
      dto.chunkOverlap >= dto.chunkSize
    ) {
      throw new BadRequestException('chunkOverlap must be smaller than chunkSize');
    }

    const kb = await this.prisma.knowledgeBase.create({
      data: {
        workspaceId,
        name: dto.name,
        description: dto.description,
        embeddingModel: dto.embeddingModel,
        chunkSize: dto.chunkSize,
        chunkOverlap: dto.chunkOverlap,
      },
    });
    this.logger.log(`Created KB ${kb.id} (${kb.name}) in workspace ${workspaceId}`);
    return kb;
  }

  async update(
    workspaceId: string,
    id: string,
    dto: UpdateKnowledgeBaseDto,
  ): Promise<KnowledgeBase> {
    const existing = await this.findById(workspaceId, id);
    const nextChunkSize = dto.chunkSize ?? existing.chunkSize;
    const nextOverlap = dto.chunkOverlap ?? existing.chunkOverlap;
    if (nextOverlap >= nextChunkSize) {
      throw new BadRequestException('chunkOverlap must be smaller than chunkSize');
    }

    return this.prisma.knowledgeBase.update({
      where: { id },
      data: dto,
    });
  }

  async delete(workspaceId: string, id: string): Promise<void> {
    await this.findById(workspaceId, id);
    await this.prisma.knowledgeBase.delete({ where: { id } });
    this.logger.log(`Deleted KB ${id} from workspace ${workspaceId}`);
  }
}
