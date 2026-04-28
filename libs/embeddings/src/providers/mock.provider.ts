import { createHash } from 'node:crypto';
import { EmbeddingsProvider } from '../embeddings.interface';

/**
 * Deterministic mock provider used when no real embedding API is available
 * (e.g. local development without OPENAI_API_KEY, unit tests).
 *
 * The "vector" is a hash-derived sequence of small floats so that:
 *   - identical inputs always produce identical vectors
 *   - similar inputs do NOT produce similar vectors (this is a mock — it
 *     is not semantically meaningful)
 */
export class MockEmbeddingsProvider implements EmbeddingsProvider {
  readonly modelId = 'mock:1536';
  readonly dimensions = 1536;

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((text) => this.hashToVector(text));
  }

  private hashToVector(text: string): number[] {
    const out = new Array<number>(this.dimensions);
    let hash = createHash('sha256').update(text).digest();
    for (let i = 0; i < this.dimensions; i++) {
      if (i > 0 && i % hash.length === 0) {
        hash = createHash('sha256').update(hash).digest();
      }
      // Each byte 0..255 → float -1..1
      out[i] = (hash[i % hash.length] - 128) / 128;
    }
    return out;
  }
}
