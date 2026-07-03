/**
 * SimilaritySearch — pure math layer for ranking embeddings by semantic closeness.
 *
 * WHY THIS IS SEPARATE FROM PERSISTENCE:
 *   MemoryRepository is responsible for I/O: serialising and reading embedding rows.
 *   SimilaritySearch is responsible for ranking: scoring vectors and returning
 *   the top-K results. The Memory Agent composes them — it loads candidates from
 *   the repository and passes them to findMostSimilar. Keeping these concerns
 *   apart means the math is testable with plain arrays (no database, no provider)
 *   and the repository is testable with plain data (no math dependency).
 *
 * WHY LOCAL COSINE SIMILARITY IS SUFFICIENT FOR V2:
 *   A pipeline run generates 5–10 ideas and 0–5 scripts. Even after 100 runs,
 *   the memory table holds at most ~1,500 entries. Scoring 1,500 512-dimensional
 *   vectors in a single JavaScript loop completes in well under 1 ms. The overhead
 *   of a network round-trip to a vector database, or the OS-level compilation
 *   required by sqlite-vec, would dwarf any algorithmic savings at this scale.
 *
 * HOW TO REPLACE THIS WITH sqlite-vec:
 *   1. Add a BLOB column `embedding_vec` to memory_entries.
 *   2. Load the sqlite-vec extension at startup.
 *   3. Populate embedding_vec via `vec_from_json(embedding)` on insert.
 *   4. Replace SimilaritySearch.findMostSimilar with:
 *        SELECT *, vec_distance_cosine(embedding_vec, vec_from_json(?)) AS score
 *        FROM memory_entries
 *        ORDER BY score ASC
 *        LIMIT ?
 *   The interface between the Memory Agent and SimilaritySearch stays the same
 *   (or SimilaritySearch becomes a thin wrapper around the SQL query).
 *
 * HOW TO REPLACE THIS WITH A VECTOR DATABASE (Pinecone / Qdrant / Weaviate):
 *   1. Rewrite MemoryRepository.saveEntry() to upsert into the vector DB.
 *   2. Rewrite findMostSimilar() to call the vector DB's query API.
 *   3. MemoryRepository retains the relational metadata (text, clientId, etc.)
 *      and resolves full MemoryEntry objects by ID after the vector DB returns IDs.
 *   No changes to EmbeddingService, VoyageEmbeddingProvider, or the Memory Agent.
 */

import type { MemoryEntry, SimilarityResult } from './types';

/**
 * Computes cosine similarity between two numeric vectors.
 *
 * Returns a value in [-1, 1]:
 *   1  → identical direction
 *   0  → orthogonal (no semantic relationship)
 *  -1  → opposite direction
 *
 * Returns 0 for any degenerate input: empty vectors, mismatched dimensions,
 * or a zero vector (undefined cosine angle).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(magA) * Math.sqrt(magB);
  if (magnitude === 0) return 0;

  return dot / magnitude;
}

export class SimilaritySearch {
  /**
   * Scores every candidate against queryEmbedding using cosine similarity,
   * then returns the topK results sorted by score descending.
   *
   * Ties are broken by insertion order (Array.sort is stable in V8 ≥ 7.0).
   * Returns fewer than topK results when candidates.length < topK.
   */
  findMostSimilar(
    queryEmbedding: number[],
    candidates: MemoryEntry[],
    topK: number,
  ): SimilarityResult[] {
    if (candidates.length === 0 || topK <= 0) return [];

    const scored: SimilarityResult[] = candidates.map((entry) => ({
      entry,
      score: cosineSimilarity(queryEmbedding, entry.embedding),
    }));

    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, topK);
  }
}
