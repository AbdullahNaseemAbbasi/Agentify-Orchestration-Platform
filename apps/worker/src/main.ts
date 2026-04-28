import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';

/**
 * Worker process entry point. Unlike the API app this does NOT call
 * `app.listen()` — there is no HTTP server. BullMQ workers attach to
 * Redis via the `@Processor()` decorator and run in the background.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    logger: ['log', 'error', 'warn', 'debug'],
  });

  await app.init();
  Logger.log('Agentify worker started — listening for jobs', 'WorkerBootstrap');

  const shutdown = async (signal: string): Promise<void> => {
    Logger.log(`Received ${signal}, shutting down…`, 'WorkerBootstrap');
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  Logger.error(`Worker failed to start: ${err}`, 'WorkerBootstrap');
  process.exit(1);
});
