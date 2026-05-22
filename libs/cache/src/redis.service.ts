import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

/**
 * Thin wrapper around a single ioredis connection.
 *
 * Used for ephemeral keys that must be visible across processes — e.g.
 * run-cancellation flags that the API sets and the runtime loop polls.
 * BullMQ keeps its own connection; this is a separate general-purpose
 * client so the two never interfere.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor(config: ConfigService) {
    const url = config.getOrThrow<string>('REDIS_URL');
    this.client = new Redis(url);
    this.client.on('error', (err) => this.logger.error(`Redis error: ${err.message}`));
  }

  /** Set a key, optionally with a time-to-live in seconds. */
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds !== undefined) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  /** True when the key currently exists. */
  async exists(key: string): Promise<boolean> {
    return (await this.client.exists(key)) === 1;
  }

  /** Delete a key. No-op when it does not exist. */
  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  /** Close the connection cleanly on app shutdown. */
  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
