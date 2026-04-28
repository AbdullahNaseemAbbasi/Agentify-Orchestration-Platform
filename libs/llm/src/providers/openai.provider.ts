import {
  LlmCompletionRequest,
  LlmCompletionResponse,
  LlmFinishReason,
  LlmMessage,
  LlmProvider,
  LlmToolCall,
} from '../llm.interface';

export interface OpenAIProviderConfig {
  apiKey: string;
  baseUrl?: string;
}

interface OpenAIToolCallShape {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

interface OpenAIChoice {
  message: {
    role: 'assistant';
    content: string | null;
    tool_calls?: OpenAIToolCallShape[];
  };
  finish_reason: string;
}

interface OpenAIResponse {
  choices: OpenAIChoice[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Minimal OpenAI Chat Completions client. Uses native fetch (Node 20+)
 * to avoid the openai SDK as a dependency for what is essentially one
 * endpoint. Internal LlmMessage already mirrors OpenAI shape so the
 * adapter is mostly a passthrough.
 */
export class OpenAILlmProvider implements LlmProvider {
  readonly providerKey = 'openai';
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(config: OpenAIProviderConfig) {
    if (!config.apiKey) {
      throw new Error('OpenAILlmProvider requires apiKey');
    }
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? 'https://api.openai.com/v1';
  }

  async complete(req: LlmCompletionRequest): Promise<LlmCompletionResponse> {
    const body: Record<string, unknown> = {
      model: req.model,
      messages: req.messages.map((m) => this.toOpenAIMessage(m)),
      temperature: req.temperature,
      max_tokens: req.maxTokens,
      top_p: req.topP,
      response_format: req.responseFormat,
    };
    if (req.tools && req.tools.length > 0) {
      body.tools = req.tools.map((t) => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.parameters },
      }));
      if (req.toolChoice !== undefined) body.tool_choice = req.toolChoice;
    }

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(this.stripUndefined(body)),
    });
    if (!res.ok) {
      throw new Error(`OpenAI API error ${res.status}: ${await res.text()}`);
    }
    const json = (await res.json()) as OpenAIResponse;
    const choice = json.choices[0];

    const toolCalls: LlmToolCall[] | undefined = choice.message.tool_calls?.map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: tc.function.arguments,
    }));

    return {
      message: {
        role: 'assistant',
        content: choice.message.content ?? '',
        toolCalls,
      },
      usage: {
        inputTokens: json.usage.prompt_tokens,
        outputTokens: json.usage.completion_tokens,
        totalTokens: json.usage.total_tokens,
      },
      finishReason: this.mapFinishReason(choice.finish_reason),
      modelId: `openai:${req.model}`,
    };
  }

  // ----------------------------------------------
  // Adapters
  // ----------------------------------------------

  private toOpenAIMessage(m: LlmMessage): Record<string, unknown> {
    if (m.role === 'tool') {
      return { role: 'tool', tool_call_id: m.toolCallId, name: m.name, content: m.content };
    }
    if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
      return {
        role: 'assistant',
        content: m.content || null,
        tool_calls: m.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: tc.arguments },
        })),
      };
    }
    return { role: m.role, content: m.content };
  }

  private mapFinishReason(reason: string): LlmFinishReason {
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'tool_calls':
      case 'function_call':
        return 'tool_calls';
      case 'length':
        return 'length';
      case 'content_filter':
        return 'content_filter';
      default:
        return 'other';
    }
  }

  private stripUndefined<T extends Record<string, unknown>>(obj: T): T {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined) out[k] = v;
    }
    return out as T;
  }
}
