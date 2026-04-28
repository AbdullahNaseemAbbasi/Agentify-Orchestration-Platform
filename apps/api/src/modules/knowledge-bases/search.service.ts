import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@agentify/database';
import { EMBEDDINGS_PROVIDER, EmbeddingsProvider } from '@agentify/embeddings';

export interface SearchHit {
  chunkId: string;
  documentId: string;
  documentName: string;
  chunkIndex: number;
  content: string;
  similarity: number;
}

interface RawHit {
  chunkId: string;
  documentId: string;
  documentName: string;
  chunkIndex: number;
  content: string;
  similarity: string | number;
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(EMBEDDINGS_PROVIDER) private readonly embeddings: EmbeddingsProvider,
  ) {}

  async searchSimilar(
    workspaceId: string,
    knowledgeBaseId: string,
    query: string,
    topK = 5,
    minSimilarity = 0,
  ): Promise<SearchHit[]> {
    // Verify the KB belongs to the caller's workspace before returning anything.
    const kb = await this.prisma.knowledgeBase.findFirst({
      where: { id: knowledgeBaseId, workspaceId },
    });
    if (!kb) {
      throw new NotFoundException('Knowledge base not found');
    }

    const [vector] = await this.embeddings.embed([query]);
    const literal = `[${vector.join(',')}]`;

    // ORDER BY distance (uses HNSW index); return similarity in the SELECT
    // for UI-friendly output. JOIN on documents to get the document name.
    const rows = await this.prisma.$queryRawUnsafe<RawHit[]>(
      `SELECT
         dc."id"           AS "chunkId",
         dc."documentId"   AS "documentId",
         d."name"          AS "documentName",
         dc."chunkIndex"   AS "chunkIndex",
         dc."content"      AS "content",
         1 - (dc."embedding" <=> $1::vector(1536)) AS "similarity"
       FROM "document_chunks" dc
       JOIN "documents" d ON d."id" = dc."documentId"
       WHERE d."knowledgeBaseId" = $2
         AND dc."embedding" IS NOT NULL
       ORDER BY dc."embedding" <=> $1::vector(1536)
       LIMIT $3`,
      literal,
      knowledgeBaseId,
      topK,
    );

    const hits: SearchHit[] = rows
      .map((r) => ({
        ...r,
        similarity: typeof r.similarity === 'string' ? Number(r.similarity) : r.similarity,
      }))
      .filter((r) => r.similarity >= minSimilarity);

    this.logger.log(
      `Search KB ${knowledgeBaseId}: query "${query.slice(0, 40)}…" -> ${hits.length} hits`,
    );
    return hits;
  }
}
