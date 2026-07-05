/**
 * MemorySearchService — queries semantic memory before idea generation.
 *
 * RESPONSIBILITIES:
 *   1. Compose a stable semantic query from the current ClientContext.
 *   2. Embed that query using EmbeddingService (same model as stored entries).
 *   3. Load all memory entries for this client from MemoryRepository.
 *   4. Score candidates with SimilaritySearch, filter by threshold, return top K.
 *
 * WHY CLIENT-SCOPED SEARCH:
 *   Content is only comparable within the same client context. A hook approved
 *   for an e-commerce brand is irrelevant diversity signal for a coaching brand.
 *   Scoping by clientId ensures every match is genuinely applicable.
 *
 * WHY ERRORS PROPAGATE TO THE ORCHESTRATOR:
 *   Unlike MemoryWriteService (fire-and-forget), search is awaited.
 *   If the search fails, the caller (orchestrator) must decide whether to continue
 *   with empty matches or abort. We propagate the error so the orchestrator can
 *   apply the right policy: log and continue, never fail the pipeline.
 *
 * QUERY COMPOSITION:
 *   Includes: niche, portfolioSummary, offer product + benefits, avatar pains/desires.
 *   Excludes: clientId, clientName, referencePackPath, brandVoice, proofBank.
 *   Goal: a stable semantic fingerprint of WHO the client is and WHAT they sell,
 *   so every pipeline run for the same client produces a similar query embedding.
 *
 * UPGRADE PATH:
 *   When the memory table grows past ~5,000 entries, replace
 *   `repository.getEntriesByClient` + `similaritySearch.findMostSimilar` with
 *   a vector-DB ANN query (Pinecone / Qdrant / sqlite-vec). The return type
 *   MemoryMatch[], and everything above and below this service, stays identical.
 */

import { EmbeddingService } from './EmbeddingService';
import { MemoryRepository, createMemoryRepository } from './MemoryRepository';
import { SimilaritySearch } from './SimilaritySearch';
import { OpenRouterEmbeddingProvider } from './OpenRouterEmbeddingProvider';
import { env } from '../config/env';
import { memorySearchConfig } from '../config/memory.config';
import type { MemoryMatch } from './types';
import type { ClientContext } from '../types/client.types';

function composeClientQuery(context: ClientContext): string {
  const avatarNames = context.avatars.map((a) => a.name).join(', ');
  const allPains = context.avatars.flatMap((a) => a.pains).join('\n');
  const allDesires = context.avatars.flatMap((a) => a.desires).join('\n');
  const offer = `${context.offerMechanics.productName} — ${context.offerMechanics.keyBenefits.join(', ')}`;

  return [
    `Target Avatar:\n${avatarNames}`,
    `Primary Pain:\n${allPains}`,
    `Desired Outcome:\n${allDesires}`,
    `Offer:\n${offer}`,
    `Content Goal:\nGenerate marketing hooks for this audience.`,
  ].join('\n\n');
}

export class MemorySearchService {
  constructor(
    private readonly embeddingService: EmbeddingService,
    private readonly repository: MemoryRepository,
    private readonly similaritySearch: SimilaritySearch
  ) {}

  async findSimilarContent(
    context: ClientContext,
    topK: number = memorySearchConfig.topK,
    threshold: number = memorySearchConfig.threshold
  ): Promise<MemoryMatch[]> {
    const start = Date.now();
    console.log(`[Memory Search] Started for client: ${context.id}`);

    const query = composeClientQuery(context);
    const queryEmbedding = await this.embeddingService.embedText(query);

    const candidates = await this.repository.getEntriesByClient(context.id);

    if (candidates.length === 0) {
      const durationMs = Date.now() - start;
      console.log(`[Memory Search] Completed — 0 candidates, 0 matches (${durationMs}ms)`);
      return [];
    }

    // Score all candidates so we can filter by threshold before slicing to topK.
    const allResults = this.similaritySearch.findMostSimilar(
      queryEmbedding,
      candidates,
      candidates.length
    );

    const filtered = allResults.filter((r) => r.score >= threshold).slice(0, topK);

    const durationMs = Date.now() - start;
    console.log(
      `[Memory Search] Completed — ${candidates.length} candidates, ${filtered.length} matches found (${durationMs}ms)`
    );

    return filtered.map((r) => ({
      sourceType: r.entry.sourceType,
      sourceId: r.entry.sourceId,
      similarity: r.score,
      aboveThreshold: r.score >= threshold,
      text: r.entry.text,
    }));
  }
}

// ---------------------------------------------------------------------------
// Factory and singleton
// ---------------------------------------------------------------------------

export function createMemorySearchService(openrouterApiKey: string): MemorySearchService | null {
  const key = openrouterApiKey?.trim();
  if (!key) return null;
  try {
    const provider = new OpenRouterEmbeddingProvider(key);
    const embeddingService = new EmbeddingService(provider);
    const repository = createMemoryRepository();
    const similaritySearch = new SimilaritySearch();
    return new MemorySearchService(embeddingService, repository, similaritySearch);
  } catch (err) {
    console.warn(
      '[Memory Search] Failed to initialise MemorySearchService:',
      err instanceof Error ? err.message : String(err)
    );
    return null;
  }
}

let _instance: MemorySearchService | null | undefined = undefined;

export function getMemorySearchService(): MemorySearchService | null {
  if (_instance !== undefined) return _instance;
  if (!env.openrouterApiKey.trim()) {
    console.warn(
      '[Memory Search] OPENROUTER_API_KEY is not set — memory search disabled. ' +
        'Idea generation will proceed without historical context.'
    );
    _instance = null;
    return null;
  }
  _instance = createMemorySearchService(env.openrouterApiKey);
  return _instance;
}
