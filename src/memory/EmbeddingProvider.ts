/**
 * IEmbeddingProvider — the abstraction layer between this application and any embedding API.
 *
 * WHY THIS ABSTRACTION EXISTS:
 *   Embedding vendors differ in API shape, model naming, pricing, and quality.
 *   Tying the application directly to the `voyageai` SDK would mean touching
 *   EmbeddingService and MemoryRepository every time we switch providers.
 *   IEmbeddingProvider exposes only what the memory module needs: a model name,
 *   a single-text embed call, and a batch embed call.
 *
 *   This is the same Dependency Inversion pattern used by AIService for text
 *   generation: high-level modules (EmbeddingService, MemoryRepository) depend
 *   on this interface, not on any specific SDK.
 *
 * CURRENT IMPLEMENTATION: OpenRouterEmbeddingProvider (see OpenRouterEmbeddingProvider.ts)
 *
 * HOW TO ADD A PROVIDER:
 *   1. Create a class that implements IEmbeddingProvider.
 *   2. Set modelName to the provider's embedding model identifier.
 *   3. Implement embed() by delegating to embedBatch([text])[0].
 *   4. Implement embedBatch() using the provider's SDK.
 *   5. Export a singleton in index.ts (or inject per-use in the Memory Agent).
 *   Zero changes to EmbeddingService, MemoryRepository, or SimilaritySearch.
 *
 * EMBEDDING DIMENSION NOTE:
 *   Different models produce different vector dimensions (512, 768, 1024, 3072).
 *   Entries created by one model cannot be compared with entries from another —
 *   cosine similarity on differently-sized vectors is meaningless. If the model
 *   changes, all stored entries must be re-embedded. The `embeddingModel` field
 *   on MemoryEntry records which model produced each vector so this can be detected.
 */

export interface IEmbeddingProvider {
  /** Identifies the embedding model — stored on every MemoryEntry for provenance. */
  readonly modelName: string;

  /** Embeds a single text string and returns a numeric vector. */
  embed(text: string): Promise<number[]>;

  /**
   * Embeds multiple texts in a single API call.
   * Implementations should prefer this over repeated embed() calls for efficiency.
   * Returns vectors in the same order as the input array.
   */
  embedBatch(texts: string[]): Promise<number[][]>;
}
