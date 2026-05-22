import {
  LlmCompletionRequest,
  LlmCompletionResponse,
  LlmFinishReason,
  LlmMessage,
  LlmProvider,
  LlmStreamChunk,
  LlmToolCall,
} from '../llm.interface';
import { parseSseStream } from './sse-stream.util';

export interface AnthropicProviderConfig {
  apiKey: string;
  baseUrl?: string;
  apiVersion?: string;
}

interface AnthropicTextBlock {
  type: 'text';
  text: string;
}
interface AnthropicToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}
type AnthropicContentBlock = AnthropicTextBlock | AnthropicToolUseBlock;

interface AnthropicResponse {
  content: AnthropicContentBlock[];
  stop_reason: string;
  usage: { input_tokens: number; output_tokens: number };
}

/**
 * One Server-Sent-Event from the streaming Messages API. The `type`
 * field discriminates: message_start, content_block_start /
 * _delta / _stop, message_delta, message_stop, ping.
 */
interface AnthropicStreamEvent {
  type: string;
  index?: number;
  message?: { usage?: { input_tokens?: number; output_tokens?: number } };
  content_block?: { type: string; id?: string; name?: string };
  delta?: { type?: string; text?: string; partial_json?: string; stop_reason?: string };
  usage?: { input_tokens?: number; output_tokens?: number };
}

/**
 * Adapter for Anthropic's Messages API.
 *
 * Key differences from OpenAI:
 *   - System prompt is a top-level `system` field, NOT a message
 *   - Tool calls are `tool_use` blocks inside `content[]` instead of a
 *     dedicated `tool_calls` array
 *   - Tool results are sent as `role: 'user'` with `tool_result` blocks
 *   - Auth uses `x-api-key` header + `anthropic-version` header
 */
export class AnthropicLlmProvider implements LlmProvider {
  readonly providerKey = 'anthropic';
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly apiVersion: string;

  constructor(config: AnthropicProviderConfig) {
    if (!config.apiKey) {
      throw new Error('AnthropicLlmProvider requires apiKey');
    }
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? 'https://api.anthropic.com/v1';
    this.apiVersion = config.apiVersion ?? '2023-06-01';
  }

  async complete(req: LlmCompletionRequest): Promise<LlmCompletionResponse> {
    const { system, messages } = this.splitSystem(req.messages);

    const body: Record<string, unknown> = {
      model: req.model,
      messages: messages.map((m) => this.toAnthropicMessage(m)),
      max_tokens: req.maxTokens ?? 4096, // Anthropic requires max_tokens
      temperature: req.temperature,
      top_p: req.topP,
    };
    if (system) body.system = system;
    if (req.tools && req.tools.length > 0) {
      body.tools = req.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      }));
      if (req.toolChoice) body.tool_choice = this.toAnthropicToolChoice(req.toolChoice);
    }

    const res = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': this.apiVersion,
      },
      body: JSON.stringify(this.stripUndefined(body)),
    });
    if (!res.ok) {
      throw new Error(`Anthropic API error ${res.status}: ${await res.text()}`);
    }
    const json = (await res.json()) as AnthropicResponse;

    const textParts: string[] = [];
    const toolCalls: LlmToolCall[] = [];
    for (const block of json.content) {
      if (block.type === 'text') {
        textParts.push(block.text);
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: JSON.stringify(block.input ?? {}),
        });
      }
    }

    return {
      message: {
        role: 'assistant',
        content: textParts.join('\n'),
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      },
      usage: {
        inputTokens: json.usage.input_tokens,
        outputTokens: json.usage.output_tokens,
        totalTokens: json.usage.input_tokens + json.usage.output_tokens,
      },
      finishReason: this.mapStopReason(json.stop_reason),
      modelId: `anthropic:${req.model}`,
    };
  }

  async *completionStream(req: LlmCompletionRequest): AsyncIterable<LlmStreamChunk> {
    const { system, messages } = this.splitSystem(req.messages);

    const body: Record<string, unknown> = {
      model: req.model,
      messages: messages.map((m) => this.toAnthropicMessage(m)),
      max_tokens: req.maxTokens ?? 4096,
      temperature: req.temperature,
      top_p: req.topP,
      stream: true,
    };
    if (system) body.system = system;
    if (req.tools && req.tools.length > 0) {
      body.tools = req.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      }));
      if (req.toolChoice) body.tool_choice = this.toAnthropicToolChoice(req.toolChoice);
    }

    const res = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': this.apiVersion,
      },
      body: JSON.stringify(this.stripUndefined(body)),
    });
    if (!res.ok || !res.body) {
      throw new Error(`Anthropic API error ${res.status}: ${await res.text()}`);
    }

    let content = '';
    // Each content block sits at an `index`; a tool_use block builds up
    // its JSON arguments across successive input_json_delta events.
    const toolDrafts = new Map<number, { id: string; name: string; arguments: string }>();
    let finishReason: LlmFinishReason = 'stop';
    let inputTokens = 0;
    let outputTokens = 0;

    for await (const data of parseSseStream(res.body)) {
      const ev = JSON.parse(data) as AnthropicStreamEvent;

      switch (ev.type) {
        case 'message_start':
          inputTokens = ev.message?.usage?.input_tokens ?? 0;
          break;
        case 'content_block_start':
          if (ev.content_block?.type === 'tool_use' && ev.index !== undefined) {
            toolDrafts.set(ev.index, {
              id: ev.content_block.id ?? '',
              name: ev.content_block.name ?? '',
              arguments: '',
            });
          }
          break;
        case 'content_block_delta':
          if (ev.delta?.type === 'text_delta' && ev.delta.text) {
            content += ev.delta.text;
            yield { type: 'delta', content: ev.delta.text };
          } else if (ev.delta?.type === 'input_json_delta' && ev.index !== undefined) {
            const draft = toolDrafts.get(ev.index);
            if (draft) draft.arguments += ev.delta.partial_json ?? '';
          }
          break;
        case 'message_delta':
          if (ev.delta?.stop_reason) finishReason = this.mapStopReason(ev.delta.stop_reason);
          if (ev.usage?.output_tokens !== undefined) outputTokens = ev.usage.output_tokens;
          break;
        // content_block_stop / message_stop / ping need no handling.
      }
    }

    const toolCalls: LlmToolCall[] | undefined =
      toolDrafts.size > 0
        ? [...toolDrafts.values()].map((d) => ({
            id: d.id,
            name: d.name,
            arguments: d.arguments || '{}',
          }))
        : undefined;

    yield {
      type: 'done',
      message: { role: 'assistant', content, toolCalls },
      usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens },
      finishReason,
      modelId: `anthropic:${req.model}`,
    };
  }

  // ----------------------------------------------
  // Adapters
  // ----------------------------------------------

  /** Anthropic wants the system prompt as a top-level field, not a message. */
  private splitSystem(messages: LlmMessage[]): { system?: string; messages: LlmMessage[] } {
    const systems = messages.filter((m) => m.role === 'system');
    const rest = messages.filter((m) => m.role !== 'system');
    if (systems.length === 0) return { messages: rest };
    return { system: systems.map((s) => s.content).join('\n\n'), messages: rest };
  }

  private toAnthropicMessage(m: LlmMessage): Record<string, unknown> {
    // Tool result coming from runtime: turn into user message with tool_result block.
    if (m.role === 'tool') {
      return {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: m.toolCallId, content: m.content }],
      };
    }
    // Assistant message with tool calls: rebuild content blocks.
    if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
      const blocks: Record<string, unknown>[] = [];
      if (m.content && m.content.length > 0) {
        blocks.push({ type: 'text', text: m.content });
      }
      for (const tc of m.toolCalls) {
        let parsed: unknown = {};
        try {
          parsed = tc.arguments ? JSON.parse(tc.arguments) : {};
        } catch {
          parsed = { _raw: tc.arguments };
        }
        blocks.push({ type: 'tool_use', id: tc.id, name: tc.name, input: parsed });
      }
      return { role: 'assistant', content: blocks };
    }
    return { role: m.role, content: m.content };
  }

  private toAnthropicToolChoice(
    choice: NonNullable<LlmCompletionRequest['toolChoice']>,
  ): Record<string, unknown> {
    if (typeof choice === 'string') {
      switch (choice) {
        case 'auto':
          return { type: 'auto' };
        case 'none':
          return { type: 'auto', disable_parallel_tool_use: true };
        case 'required':
          return { type: 'any' };
        default:
          return { type: 'auto' };
      }
    }
    return { type: 'tool', name: choice.function.name };
  }

  private mapStopReason(reason: string): LlmFinishReason {
    switch (reason) {
      case 'end_turn':
      case 'stop_sequence':
        return 'stop';
      case 'tool_use':
        return 'tool_calls';
      case 'max_tokens':
        return 'length';
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
