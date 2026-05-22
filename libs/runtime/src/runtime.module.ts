import { Module } from '@nestjs/common';
import { HttpToolExecutor } from './http-tool.executor';
import { RunsService } from './runs.service';
import { SearchService } from './search.service';

/**
 * The agent runtime engine, packaged as a NestJS module so both the
 * HTTP API and the background worker can run agents from one codebase.
 *
 * Its dependencies — Prisma, the LLM registry, the embeddings provider
 * and Redis — all come from @Global modules, so an app only needs to
 * import RuntimeModule itself (plus those globals at its root).
 */
@Module({
  providers: [RunsService, SearchService, HttpToolExecutor],
  exports: [RunsService, SearchService, HttpToolExecutor],
})
export class RuntimeModule {}
