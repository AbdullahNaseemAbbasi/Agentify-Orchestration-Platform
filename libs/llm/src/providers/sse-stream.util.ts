/**
 * Parses an HTTP `text/event-stream` body into its successive `data:`
 * payloads. Both OpenAI and Anthropic stream completions this way, so
 * the byte-buffering + line-splitting lives here once.
 *
 * Network data arrives in arbitrary-sized chunks that do not line up
 * with event boundaries, so we accumulate into a buffer and only emit
 * an event once its terminating blank line has been seen.
 *
 * Yields the raw string after `data:` for each event. The caller is
 * responsible for JSON-parsing and for recognising sentinels such as
 * OpenAI's `[DONE]`.
 */
export async function* parseSseStream(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      // Normalise CRLF so a single '\n\n' check finds every boundary.
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');

      // Events are separated by a blank line. Drain every complete event
      // in the buffer; keep the trailing partial for the next read.
      let sep = buffer.indexOf('\n\n');
      while (sep !== -1) {
        const rawEvent = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        for (const line of rawEvent.split('\n')) {
          if (line.startsWith('data:')) {
            yield line.slice(5).trim();
          }
        }
        sep = buffer.indexOf('\n\n');
      }
    }
  } finally {
    reader.releaseLock();
  }
}
