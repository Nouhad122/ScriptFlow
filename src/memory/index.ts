/**
 * Memory module — public API.
 *
 * Everything exported here is available to callers of `src/memory`.
 * Internal helpers (TABLE_DDL, rowToEntry, PROVIDER_NAME, etc.) stay hidden.
 *
 * Nothing outside this module imports from here yet (V2 foundation only).
 * When the Memory Agent is added, it will be the sole external consumer.
 */

export type { MemoryEntry, MemorySourceType, SimilarityResult, MemoryMatch } from './types';
export { EmbeddingProviderError } from './types';

export type { IEmbeddingProvider } from './EmbeddingProvider';

export { OpenRouterEmbeddingProvider } from './OpenRouterEmbeddingProvider';

export { cosineSimilarity, SimilaritySearch } from './SimilaritySearch';

export { EmbeddingService } from './EmbeddingService';

export { MemoryRepository, createMemoryRepository } from './MemoryRepository';

export {
  MemoryWriteService,
  createMemoryWriteService,
  getMemoryWriteService,
} from './MemoryWriteService';

export {
  MemorySearchService,
  createMemorySearchService,
  getMemorySearchService,
} from './MemorySearchService';
