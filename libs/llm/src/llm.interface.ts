/**
 * Unified LLM provider contract. Internal message + tool shape mirrors
 * the OpenAI Chat Completions API since that is the closest to a de
 * facto industry standard. Provider implementations adapt to/from
 * each remote API as needed.
 */

export type LlmRole = 'system' | 'user' | 'assistant' | 'tool';

export interface LlmToolCall {   
  id: string; 
  name: string;
  /** Stringified JSON arguments — mirrors OpenAI tool_calls.function.arguments. */
  arguments: string; 
}

export interface LlmMessage {
  role: LlmRole;
  /** Plain text content. May be empty when an assistant emits only tool calls. */
  content: string;
  /** Present only on assistant messages that emit tool calls. */
  toolCalls?: LlmToolCall[];
  /** Present only on `role: 'tool'` messages — links back to a tool_call.id. */
  toolCallId?: string;
  /** Present only on `role: 'tool'` messages — name of the tool being responded to. */
  name?: string;
}

export interface LlmToolDefinition {
  name: string;
  description: string;
  /** JSON Schema (object) describing the function arguments. */
  parameters: Record<string, unknown>;
}

export interface LlmCompletionRequest {
  model: string;
  messages: LlmMessage[];
  tools?: LlmToolDefinition[];
  /** "auto" | "none" | "required" | { type: "function", function: { name } } */
  toolChoice?: string | { type: 'function'; function: { name: string } };
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  responseFormat?: Record<string, unknown>;
}

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export type LlmFinishReason = 'stop' | 'tool_calls' | 'length' | 'content_filter' | 'other';

export interface LlmCompletionResponse {
  message: LlmMessage;
  usage: LlmUsage;
  finishReason: LlmFinishReason;
  /** Raw provider name + model for traceability. */
  modelId: string;
}

export interface LlmProvider {
  /** Lowercased provider key as stored on Agent.provider (e.g. "openai"). */
  readonly providerKey: string;

  complete(req: LlmCompletionRequest): Promise<LlmCompletionResponse>;
}
