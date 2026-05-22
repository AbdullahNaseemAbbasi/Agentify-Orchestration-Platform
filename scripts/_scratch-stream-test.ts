// Temporary sanity check — proves MockLlmProvider streams in real time.
// Deleted right after running (see PROGRESS.md Session 6 scratch pattern).
import { MockLlmProvider } from '../libs/llm/src/providers/mock.provider';

async function main(): Promise<void> {
  const provider = new MockLlmProvider();
  const start = Date.now();

  console.log('--- text streaming ---');
  for await (const chunk of provider.completionStream({
    model: 'mock-model',
    messages: [{ role: 'user', content: 'Hello real time streaming test' }],
  })) {
    const t = Date.now() - start;
    if (chunk.type === 'delta') {
      console.log(`[+${t}ms] delta: ${JSON.stringify(chunk.content)}`);
    } else {
      console.log(`[+${t}ms] done: content=${JSON.stringify(chunk.message.content)}`);
      console.log(`         usage=${JSON.stringify(chunk.usage)} finish=${chunk.finishReason}`);
    }
  }

  console.log('--- tool-call path ---');
  for await (const chunk of provider.completionStream({
    model: 'mock-model',
    messages: [{ role: 'user', content: 'please use tool now' }],
    tools: [{ name: 'get_weather', description: 'x', parameters: { type: 'object' } }],
  })) {
    if (chunk.type === 'done') {
      console.log(`done: finish=${chunk.finishReason} toolCalls=${JSON.stringify(chunk.message.toolCalls)}`);
    }
  }

  console.log('STREAM TEST OK');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
