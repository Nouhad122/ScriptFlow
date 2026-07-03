export type MemorySourceType = 'idea' | 'script';

export interface MemoryEntry {
  id: string;
  sourceType: MemorySourceType;
  sourceId: string;
  clientId: string;
  pipelineRunId: string;
  text: string;
  embeddingModel: string;
  embedding: number[];
  createdAt: Date;
}

export interface SimilarityResult {
  entry: MemoryEntry;
  score: number;
}

/**
 * A single result from a semantic memory search, projected for agent consumption.
 * Agents receive only what they need — full MemoryEntry internals stay in the memory module.
 *
 * aboveThreshold — true when similarity >= the configured MemorySearch threshold.
 *   Currently always true for returned matches (the service filters at the threshold),
 *   but included explicitly so consumers can render quality tiers without knowing
 *   the backend's configured value, and so the field survives future threshold changes.
 */
export interface MemoryMatch {
  sourceType: MemorySourceType;
  sourceId: string;
  similarity: number;
  aboveThreshold: boolean;
  text: string;
}

export class EmbeddingProviderError extends Error {
  constructor(
    message: string,
    readonly provider: string,
  ) {
    super(`[${provider}] Embedding failed: ${message}`);
    this.name = 'EmbeddingProviderError';
  }
}
