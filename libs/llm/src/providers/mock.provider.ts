import {
  LlmCompletionRequest,
  LlmCompletionResponse,
  LlmProvider,
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
      Array.isArray(req.tools) &&
      req.tools.length > 0 &&
      /use tool/i.test(userText);

    if (wantsTool) {
      const tool = req.tools![0];
      return {
        message: {
          role: 'assistant',
          content: '',
          toolCalls: [
            { id: `call_${Date.now()}`, name: tool.name, arguments: '{}' },
          ],
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

  private fakeUsage(req: LlmCompletionRequest, reply: string): {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  } {
    const input = req.messages.reduce(
      (acc, m) => acc + Math.ceil(m.content.length / 4),
      0,
    );
    const output = Math.ceil(reply.length / 4);
    return { inputTokens: input, outputTokens: output, totalTokens: input + output };
  }
}
