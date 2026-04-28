import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmbeddingsProvider } from './embeddings.interface';
import { MockEmbeddingsProvider } from './providers/mock.provider';
import { OpenAIEmbeddingsProvider } from './providers/openai.provider';

export const EMBEDDINGS_PROVIDER = Symbol('EMBEDDINGS_PROVIDER');

/**
 * Global module that constructs an EmbeddingsProvider based on env:
 *   - if OPENAI_API_KEY is set, uses OpenAIEmbeddingsProvider
 *   - otherwise falls back to MockEmbeddingsProvider (good for local dev
 *     without a paid API key)
 *
 * Inject with @Inject(EMBEDDINGS_PROVIDER).
 */
@Global()
@Module({
  providers: [
    {
      provide: EMBEDDINGS_PROVIDER,
      useFactory: (config: ConfigService): EmbeddingsProvider => {
        const apiKey = config.get<string>('OPENAI_API_KEY');
        if (apiKey && apiKey.length > 0) {
          return new OpenAIEmbeddingsProvider({
            apiKey,
            model: config.get<string>('OPENAI_EMBEDDING_MODEL') ?? 'text-embedding-3-small',
          });
        }
        return new MockEmbeddingsProvider();
      },
      inject: [ConfigService],
    },
  ],
  exports: [EMBEDDINGS_PROVIDER],
})
export class EmbeddingsModule {}
