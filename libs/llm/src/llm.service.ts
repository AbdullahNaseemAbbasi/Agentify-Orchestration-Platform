import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmCompletionRequest, LlmCompletionResponse, LlmProvider } from './llm.interface';
import { AnthropicLlmProvider } from './providers/anthropic.provider';
import { MockLlmProvider } from './providers/mock.provider';
import { OpenAILlmProvider } from './providers/openai.provider';

/**
 * Multi-provider registry. Selects which LlmProvider to use based on
 * the agent's `provider` field (e.g. "openai" -> OpenAI, "anthropic"
 * -> Anthropic). Falls back to mock when the corresponding API key
 * is missing in env, so local dev never hard-crashes for missing
 * credentials.
 */
@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly providers = new Map<string, LlmProvider>();
  private readonly mock = new MockLlmProvider();

  constructor(private readonly config: ConfigService) {
    const openaiKey = this.config.get<string>('OPENAI_API_KEY');
    if (openaiKey) {
      this.providers.set('openai', new OpenAILlmProvider({ apiKey: openaiKey }));
      this.logger.log('OpenAI LLM provider registered');
    }
    const anthropicKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (anthropicKey) {
      this.providers.set(
        'anthropic',
        new AnthropicLlmProvider({ apiKey: anthropicKey }),
      );
      this.logger.log('Anthropic LLM provider registered');
    }
    if (this.providers.size === 0) {
      this.logger.warn('No real LLM API keys configured — falling back to mock provider');
    }
  }

  /**
   * Resolve the provider for a given key (typically `agent.provider`).
   * Returns mock if the requested provider has no credentials.
   */
  providerFor(key: string): LlmProvider {
    const normalized = key.toLowerCase().trim();
    if (normalized === 'mock') return this.mock;
    const real = this.providers.get(normalized);
    if (real) return real;
    this.logger.warn(`No credentials for provider '${key}', using mock`);
    return this.mock;
  }

  async complete(providerKey: string, req: LlmCompletionRequest): Promise<LlmCompletionResponse> {
    if (!req.model || req.model.length === 0) {
      throw new BadRequestException('model is required');
    }
    if (!Array.isArray(req.messages) || req.messages.length === 0) {
      throw new BadRequestException('messages must be a non-empty array');
    }
    return this.providerFor(providerKey).complete(req);
  }
}
