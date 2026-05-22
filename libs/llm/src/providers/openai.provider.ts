import {
  LlmCompletionRequest,
  LlmCompletionResponse,
  LlmFinishReason,
  LlmMessage,
  LlmProvider,
  LlmStreamChunk,
  LlmToolCall,
  LlmUsage,
} from '../llm.interface';
import { parseSseStream } from './sse-stream.util';

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

/** A tool-call fragment as it appears inside a streaming delta. */
interface OpenAIStreamToolCall {
  index: number;
  id?: string;
  function?: { name?: string; arguments?: string };
}

/** A single Server-Sent-Event chunk from the streaming endpoint. */
interface OpenAIStreamChunk {
  choices?: Array<{
    delta?: { content?: string; tool_calls?: OpenAIStreamToolCall[] };
    finish_reason?: string | null;
  }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | null;
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

  async *completionStream(req: LlmCompletionRequest): AsyncIterable<LlmStreamChunk> {
    const body: Record<string, unknown> = {
      model: req.model,
      messages: req.messages.map((m) => this.toOpenAIMessage(m)),
      temperature: req.temperature,
      max_tokens: req.maxTokens,
      top_p: req.topP,
      response_format: req.responseFormat,
      stream: true,
      // Ask OpenAI to send a final usage chunk — streaming omits it otherwise.
      stream_options: { include_usage: true },
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
    if (!res.ok || !res.body) {
      throw new Error(`OpenAI API error ${res.status}: ${await res.text()}`);
    }

    let content = '';
    // Tool calls stream as fragments keyed by index — id + name arrive
    // once, arguments build up across many chunks.
    const toolDrafts = new Map<number, { id: string; name: string; arguments: string }>();
    let finishReason: LlmFinishReason = 'stop';
    let usage: LlmUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

    for await (const data of parseSseStream(res.body)) {
      if (data === '[DONE]') break;
      const chunk = JSON.parse(data) as OpenAIStreamChunk;

      if (chunk.usage) {
        usage = {
          inputTokens: chunk.usage.prompt_tokens,
          outputTokens: chunk.usage.completion_tokens,
          totalTokens: chunk.usage.total_tokens,
        };
      }

      const choice = chunk.choices?.[0];
      if (!choice) continue;

      if (choice.delta?.content) {
        content += choice.delta.content;
        yield { type: 'delta', content: choice.delta.content };
      }
      for (const tc of choice.delta?.tool_calls ?? []) {
        const draft = toolDrafts.get(tc.index) ?? { id: '', name: '', arguments: '' };
        if (tc.id) draft.id = tc.id;
        if (tc.function?.name) draft.name = tc.function.name;
        if (tc.function?.arguments) draft.arguments += tc.function.arguments;
        toolDrafts.set(tc.index, draft);
      }
      if (choice.finish_reason) {
        finishReason = this.mapFinishReason(choice.finish_reason);
      }
    }

    const toolCalls: LlmToolCall[] | undefined =
      toolDrafts.size > 0 ? [...toolDrafts.values()] : undefined;

    yield {
      type: 'done',
      message: { role: 'assistant', content, toolCalls },
      usage,
      finishReason,
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
