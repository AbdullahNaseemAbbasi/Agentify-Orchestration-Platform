/**
 * Common contract for embedding providers. Implementations decide which
 * remote model to call (OpenAI, Cohere, etc.) or provide a deterministic
 * mock for tests.
 */
export interface EmbeddingsProvider {
  /** Human-readable name for logs/traces (e.g. "openai:text-embedding-3-small"). */
  readonly modelId: string;

  /** Vector dimensionality this provider returns (must match DB column). */
  readonly dimensions: number;

  /** Embed a batch of texts. Order of input must match order of output. */
  embed(texts: string[]): Promise<number[][]>;
}
