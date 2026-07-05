import OpenAI, { APIError } from 'openai';
import { EmbeddingProviderError } from './types';
import type { IEmbeddingProvider } from './EmbeddingProvider';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const EMBEDDING_MODEL = 'openai/text-embedding-3-small';
const PROVIDER_NAME = 'openrouter';

export class OpenRouterEmbeddingProvider implements IEmbeddingProvider {
  readonly modelName = EMBEDDING_MODEL;
  private readonly client: OpenAI;

  constructor(apiKey: string) {
    if (!apiKey?.trim()) {
      throw new EmbeddingProviderError(
        'OPENROUTER_API_KEY is missing or empty. Add it to .env: OPENROUTER_API_KEY=sk-or-...',
        PROVIDER_NAME
      );
    }
    this.client = new OpenAI({
      baseURL: OPENROUTER_BASE_URL,
      apiKey: apiKey.trim(),
    });
  }

  async embed(text: string): Promise<number[]> {
    const results = await this.embedBatch([text]);
    const embedding = results[0];
    if (!embedding) {
      throw new EmbeddingProviderError('No embedding returned for single text', PROVIDER_NAME);
    }
    return embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    let response;
    try {
      response = await this.client.embeddings.create({
        model: this.modelName,
        input: texts,
      });
    } catch (err) {
      const message =
        err instanceof APIError ? err.message : err instanceof Error ? err.message : String(err);
      throw new EmbeddingProviderError(message, PROVIDER_NAME);
    }

    const data = response.data;
    if (!data || data.length === 0) {
      throw new EmbeddingProviderError('Provider returned empty data array', PROVIDER_NAME);
    }
    if (data.length !== texts.length) {
      throw new EmbeddingProviderError(
        `Expected ${texts.length} embeddings, received ${data.length}`,
        PROVIDER_NAME
      );
    }

    return data.map((item, i) => {
      if (!item.embedding || item.embedding.length === 0) {
        throw new EmbeddingProviderError(`Missing embedding vector at index ${i}`, PROVIDER_NAME);
      }
      return item.embedding;
    });
  }
}
