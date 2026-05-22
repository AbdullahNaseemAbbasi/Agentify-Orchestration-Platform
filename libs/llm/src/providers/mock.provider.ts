import {
  LlmCompletionRequest,
  LlmCompletionResponse,
  LlmProvider,
  LlmStreamChunk,
} from '../llm.interface';

/**
 * Deterministic mock provider used when no real API key is configured.
 *
 * Behavior:
 *   - If tools are provided AND the most recent user message contains
 *     "use tool" (case-insensitive), the assistant emits a tool_call
 *     for the FIRST tool with empty JSON args (so the runtime loop can
 *     be exercised without burning real tokens).
 *   - Otherwise the assistant echoes a short canned reply that includes
 *     the last user input — useful for end-to-end tests.
 */
export class MockLlmProvider implements LlmProvider {
  readonly providerKey = 'mock';

  async complete(req: LlmCompletionRequest): Promise<LlmCompletionResponse> {
    const lastUser = [...req.messages].reverse().find((m) => m.role === 'user');
    const userText = lastUser?.content ?? '';

    const wantsTool =
      Array.isArray(req.tools) && req.tools.length > 0 && /use tool/i.test(userText);

    if (wantsTool) {
      const tool = req.tools![0];
      return {
        message: {
          role: 'assistant',
          content: '',
          toolCalls: [{ id: `call_${Date.now()}`, name: tool.name, arguments: '{}' }],
        },
        usage: this.fakeUsage(req, ''),
        finishReason: 'tool_calls',
        modelId: `mock:${req.model}`,
      };
    }

    const reply = `[mock] You said: ${userText.slice(0, 100)}`;
    return {
      message: { role: 'assistant', content: reply },
      usage: this.fakeUsage(req, reply),
      finishReason: 'stop',
      modelId: `mock:${req.model}`,
    };
  }

  /**
   * Streaming variant. Same canned logic as `complete`, but the reply
   * is emitted word-by-word with a small real delay — so the whole SSE
   * pipeline gets a genuine "typing" effect with no API key.
   */
  async *completionStream(req: LlmCompletionRequest): AsyncIterable<LlmStreamChunk> {
    const lastUser = [...req.messages].reverse().find((m) => m.role === 'user');
    const userText = lastUser?.content ?? '';

    const wantsTool =
      Array.isArray(req.tools) && req.tools.length > 0 && /use tool/i.test(userText);

    if (wantsTool) {
      // Tool calls are not streamed as text — hand back a single done chunk.
      const tool = req.tools![0];
      yield {
        type: 'done',
        message: {
          role: 'assistant',
          content: '',
          toolCalls: [{ id: `call_${Date.now()}`, name: tool.name, arguments: '{}' }],
        },
        usage: this.fakeUsage(req, ''),
        finishReason: 'tool_calls',
        modelId: `mock:${req.model}`,
      };
      return;
    }

    const reply = `[mock] You said: ${userText.slice(0, 100)}`;
    const words = reply.split(' ');
    let assembled = '';
    for (let i = 0; i < words.length; i++) {
      const piece = i === 0 ? words[i] : ` ${words[i]}`;
      assembled += piece;
      yield { type: 'delta', content: piece };
      await this.sleep(60); // genuine real-time pacing
    }

    yield {
      type: 'done',
      message: { role: 'assistant', content: assembled },
      usage: this.fakeUsage(req, assembled),
      finishReason: 'stop',
      modelId: `mock:${req.model}`,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private fakeUsage(
    req: LlmCompletionRequest,
    reply: string,
  ): {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  } {
    const input = req.messages.reduce((acc, m) => acc + Math.ceil(m.content.length / 4), 0);
    const output = Math.ceil(reply.length / 4);
    return { inputTokens: input, outputTokens: output, totalTokens: input + output };
  }
}
