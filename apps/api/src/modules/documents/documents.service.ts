import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Document, Prisma } from '@prisma/client';
import { Queue } from 'bullmq';
import { PrismaService } from '@agentify/database';
import {
  DOCUMENT_PROCESSING_JOB_NAME,
  DocumentProcessingJob,
  QUEUE_NAMES,
} from '@agentify/queue';
import { CreateTextDocumentDto } from './dto/create-text-document.dto';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.DOCUMENT_PROCESSING)
    private readonly indexingQueue: Queue<DocumentProcessingJob>,
  ) {}

  async findAll(workspaceId: string, knowledgeBaseId: string): Promise<Document[]> {
    await this.requireKb(workspaceId, knowledgeBaseId);
    return this.prisma.document.findMany({
      where: { knowledgeBaseId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(workspaceId: string, knowledgeBaseId: string, id: string): Promise<Document> {
    await this.requireKb(workspaceId, knowledgeBaseId);
    const doc = await this.prisma.document.findFirst({
      where: { id, knowledgeBaseId },
    });
    if (!doc) {
      throw new NotFoundException('Document not found');
    }
    return doc;
  }

  async createText(
    workspaceId: string,
    knowledgeBaseId: string,
    dto: CreateTextDocumentDto,
  ): Promise<Document> {
    await this.requireKb(workspaceId, knowledgeBaseId);

    const doc = await this.prisma.document.create({
      data: {
        knowledgeBaseId,
        name: dto.name,
        source: 'text',
        sizeBytes: Buffer.byteLength(dto.text, 'utf8'),
        status: 'PENDING',
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
      },
    });

    await this.indexingQueue.add(
      DOCUMENT_PROCESSING_JOB_NAME,
      {
        documentId: doc.id,
        knowledgeBaseId,
        workspaceId,
        text: dto.text,
      },
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
    );

    this.logger.log(`Queued document ${doc.id} for indexing in KB ${knowledgeBaseId}`);
    return doc;
  }

  async delete(workspaceId: string, knowledgeBaseId: string, id: string): Promise<void> {
    await this.findById(workspaceId, knowledgeBaseId, id);
    await this.prisma.document.delete({ where: { id } });
    this.logger.log(`Deleted document ${id}`);
  }

  /** Throws 404 if the workspace doesn't own this KB — used by every method. */
  private async requireKb(workspaceId: string, kbId: string): Promise<void> {
    const kb = await this.prisma.knowledgeBase.findFirst({
      where: { id: kbId, workspaceId },
    });
    if (!kb) {
      throw new NotFoundException('Knowledge base not found');
    }
  }
}
