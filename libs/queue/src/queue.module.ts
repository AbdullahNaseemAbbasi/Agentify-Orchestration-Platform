import { BullModule } from '@nestjs/bullmq';
import { DynamicModule, Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QUEUE_NAMES } from './queue-names';

/**
 * Global module that wires BullMQ to Redis using REDIS_URL from env.
 * Apps choose which queues to register with .registerQueue(...) so a
 * worker app only attaches workers to the queues it consumes.
 */
@Global()
@Module({})
export class QueueModule {
  /** Wire shared connection settings. Call once in the root module. */
  static forRoot(): DynamicModule {
    return {
      module: QueueModule,
      imports: [
        BullModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (config: ConfigService) => {
            const url = config.getOrThrow<string>('REDIS_URL');
            return { connection: { url } };
          },
        }),
      ],
      exports: [BullModule],
    };
  }

  /** Register the named queue(s) on this app. */
  static registerQueues(...names: Array<keyof typeof QUEUE_NAMES>): DynamicModule {
    const queueConfigs = names.map((key) => ({ name: QUEUE_NAMES[key] }));
    return {
      module: QueueModule,
      imports: [BullModule.registerQueue(...queueConfigs)],
      exports: [BullModule],
    };
  }
}
