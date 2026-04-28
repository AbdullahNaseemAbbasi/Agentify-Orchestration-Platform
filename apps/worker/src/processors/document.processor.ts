import { Inject, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '@agentify/database';
import { EMBEDDINGS_PROVIDER, EmbeddingsProvider } from '@agentify/embeddings';
import {
  DOCUMENT_PROCESSING_JOB_NAME,
  DocumentProcessingJob,
  QUEUE_NAMES,
} from '@agentify/queue';

@Processor(QUEUE_NAMES.DOCUMENT_PROCESSING)
export class DocumentProcessor extends WorkerHost {
  private readonly logger = new Logger(DocumentProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(EMBEDDINGS_PROVIDER) private readonly embeddings: EmbeddingsProvider,
  ) {
    super();
  }

  async process(job: Job<DocumentProcessingJob>): Promise<void> {
    if (job.name !== DOCUMENT_PROCESSING_JOB_NAME) {
      this.logger.warn(`Skipping unknown job name: ${job.name}`);
      return;
    }
    const { documentId, knowledgeBaseId, text } = job.data;
    this.logger.log(`Processing document ${documentId} (${text.length} chars)`);

    try {
      await this.prisma.document.update({
        where: { id: documentId },
        data: { status: 'PROCESSING', errorMessage: null },
      });

      const kb = await this.prisma.knowledgeBase.findUniqueOrThrow({
        where: { id: knowledgeBaseId },
      });

      const chunks = this.chunkText(text, kb.chunkSize, kb.chunkOverlap);
      this.logger.log(`Chunked into ${chunks.length} pieces`);

      // Embed in batches of 64 to stay below provider rate / size limits.
      const BATCH = 64;
      const allVectors: number[][] = [];
      for (let i = 0; i < chunks.length; i += BATCH) {
        const slice = chunks.slice(i, i + BATCH);
        const vectors = await this.embeddings.embed(slice);
        allVectors.push(...vectors);
      }

      // Wipe existing chunks first (re-indexing keeps data consistent).
      await this.prisma.documentChunk.deleteMany({ where: { documentId } });

      // pgvector cannot be set through Prisma's client API directly, so
      // every chunk goes via raw SQL. We do them one-at-a-time inside a
      // transaction; for production, batched COPY would be much faster.
      await this.prisma.$transaction(
        chunks.map((content, idx) =>
          this.prisma.$executeRawUnsafe(
            `INSERT INTO "document_chunks" ("id", "documentId", "chunkIndex", "content", "tokenCount", "embedding", "createdAt")
             VALUES (gen_random_uuid(), $1, $2, $3, $4, $5::vector(1536), NOW())`,
            documentId,
            idx,
            content,
            this.estimateTokens(content),
            this.formatVector(allVectors[idx]),
          ),
        ),
      );

      await this.prisma.document.update({
        where: { id: documentId },
        data: { status: 'INDEXED', errorMessage: null },
      });

      this.logger.log(`Document ${documentId} indexed: ${chunks.length} chunks stored`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error';
      this.logger.error(`Failed to index ${documentId}: ${message}`);
      await this.prisma.document
        .update({
          where: { id: documentId },
          data: { status: 'FAILED', errorMessage: message.slice(0, 500) },
        })
        .catch(() => undefined);
      throw err;
    }
  }

  // ----------------------------------------------
  // Helpers
  // ----------------------------------------------

  /** Naive character-based chunking with overlap. Future: token-aware. */
  private chunkText(text: string, size: number, overlap: number): string[] {
    if (text.length <= size) return [text];
    const stride = Math.max(1, size - overlap);
    const chunks: string[] = [];
    for (let start = 0; start < text.length; start += stride) {
      const piece = text.slice(start, start + size);
      if (piece.length === 0) break;
      chunks.push(piece);
      if (start + size >= text.length) break;
    }
    return chunks;
  }

  /** Rough heuristic — 1 token ≈ 4 chars for English. Real tokenizer later. */
  private estimateTokens(text: string): number {
    return Math.max(1, Math.ceil(text.length / 4));
  }

  /** pgvector text format: '[0.1,0.2,...]'. */
  private formatVector(vec: number[]): string {
    return `[${vec.join(',')}]`;
  }
}
