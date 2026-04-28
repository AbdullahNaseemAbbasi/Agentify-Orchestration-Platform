import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@agentify/database';

export interface DbHealth {
  status: 'ok' | 'error';
  latencyMs: number;
  error?: string;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly prisma: PrismaService) {}

  async checkDatabase(): Promise<DbHealth> {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', latencyMs: Date.now() - start };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error';
      this.logger.error(`Database health check failed: ${message}`);
      return { status: 'error', latencyMs: Date.now() - start, error: message };
    }
  }
}
