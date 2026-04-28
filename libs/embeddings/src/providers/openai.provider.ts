import { EmbeddingsProvider } from '../embeddings.interface';

/**
 * Calls the OpenAI Embeddings REST API. Default model is
 * `text-embedding-3-small` (1536 dims) — same dimensionality as our
 * Postgres `vector(1536)` column.
 *
 * Uses fetch (Node 20+) to avoid pulling the openai SDK as a dependency
 * for what is a single endpoint call.
 */
export interface OpenAIEmbeddingsConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

export class OpenAIEmbeddingsProvider implements EmbeddingsProvider {
  readonly modelId: string;
  readonly dimensions = 1536;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(config: OpenAIEmbeddingsConfig) {
    if (!config.apiKey) {
      throw new Error('OpenAIEmbeddingsProvider requires apiKey');
    }
    this.apiKey = config.apiKey;
    this.model = config.model ?? 'text-embedding-3-small';
    this.baseUrl = config.baseUrl ?? 'https://api.openai.com/v1';
    this.modelId = `openai:${this.model}`;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const res = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ model: this.model, input: texts }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI embeddings API error ${res.status}: ${errText}`);
    }

    const json = (await res.json()) as {
      data: Array<{ index: number; embedding: number[] }>;
    };

    // The API returns items in the same order as the request, but defend
    // against future changes by sorting on `index`.
    return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
  }
}
