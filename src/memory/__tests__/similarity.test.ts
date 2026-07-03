import { describe, it, expect } from 'vitest';
import { cosineSimilarity, SimilaritySearch } from '../SimilaritySearch';
import type { MemoryEntry } from '../types';

function makeEntry(id: string, embedding: number[]): MemoryEntry {
  return {
    id,
    sourceType: 'idea',
    sourceId: `src-${id}`,
    clientId: 'client-1',
    pipelineRunId: 'run-1',
    text: `text-${id}`,
    embeddingModel: 'test-model',
    embedding,
    createdAt: new Date(),
  };
}

// ── cosineSimilarity ─────────────────────────────────────────────────────────

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1);
  });

  it('returns -1 for exactly opposite vectors', () => {
    expect(cosineSimilarity([1, 0, 0], [-1, 0, 0])).toBeCloseTo(-1);
  });

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBeCloseTo(0);
  });

  it('returns 0 for a zero vector', () => {
    expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
  });

  it('returns 0 for two zero vectors', () => {
    expect(cosineSimilarity([0, 0], [0, 0])).toBe(0);
  });

  it('returns 0 for mismatched dimensions', () => {
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
  });

  it('returns 0 for empty vectors', () => {
    expect(cosineSimilarity([], [])).toBe(0);
  });

  it('is symmetric', () => {
    const a = [0.6, 0.8, 0.0];
    const b = [0.0, 1.0, 0.0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(cosineSimilarity(b, a));
  });

  it('is scale invariant — multiplying a vector by a scalar does not change the score', () => {
    const a = [1, 0];
    const b = [3, 4];
    const bScaled = [6, 8];
    expect(cosineSimilarity(a, b)).toBeCloseTo(cosineSimilarity(a, bScaled));
  });

  it('correctly scores two non-axis-aligned vectors', () => {
    // [0.6, 0.8] and [0.8, 0.6] are both unit vectors; dot = 0.6*0.8 + 0.8*0.6 = 0.96
    expect(cosineSimilarity([0.6, 0.8], [0.8, 0.6])).toBeCloseTo(0.96);
  });
});

// ── SimilaritySearch ─────────────────────────────────────────────────────────

describe('SimilaritySearch.findMostSimilar', () => {
  const search = new SimilaritySearch();

  const candidates = [
    makeEntry('a', [1, 0, 0]),   // axis-aligned X
    makeEntry('b', [0, 1, 0]),   // axis-aligned Y
    makeEntry('c', [0, 0, 1]),   // axis-aligned Z
    makeEntry('d', [0.6, 0.8, 0]), // 53° from X in XY-plane
  ];

  it('returns the exact top-K results sorted by score descending', () => {
    const results = search.findMostSimilar([1, 0, 0], candidates, 2);
    expect(results).toHaveLength(2);
    expect(results[0].entry.id).toBe('a');
    expect(results[0].score).toBeCloseTo(1);
    expect(results[1].score).toBeLessThanOrEqual(results[0].score);
  });

  it('returns fewer than K when candidates.length < K', () => {
    const results = search.findMostSimilar([1, 0, 0], candidates, 100);
    expect(results).toHaveLength(candidates.length);
  });

  it('returns empty array for empty candidates', () => {
    expect(search.findMostSimilar([1, 0, 0], [], 5)).toHaveLength(0);
  });

  it('returns empty array when topK is 0', () => {
    expect(search.findMostSimilar([1, 0, 0], candidates, 0)).toHaveLength(0);
  });

  it('results are always sorted descending by score', () => {
    const results = search.findMostSimilar([0.6, 0.8, 0], candidates, 4);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  it('each result carries a numeric score in [-1, 1]', () => {
    const results = search.findMostSimilar([1, 0, 0], candidates, 1);
    expect(typeof results[0].score).toBe('number');
    expect(results[0].score).toBeGreaterThanOrEqual(-1);
    expect(results[0].score).toBeLessThanOrEqual(1);
  });

  it('ranks the closest vector first for a diagonal query', () => {
    // Query points equally between X and Y; entry 'd' [0.6, 0.8, 0] is closer
    // to [1,1,0] than pure X or Y axis entries because it lies in the XY-plane.
    const query = [1, 1, 0];
    const results = search.findMostSimilar(query, candidates, 4);
    expect(results[0].entry.id).toBe('d');
  });

  it('does not mutate the candidates array', () => {
    const frozen = candidates.map((e) => ({ ...e }));
    search.findMostSimilar([1, 0, 0], frozen, 2);
    frozen.forEach((entry, i) => {
      expect(entry.id).toBe(candidates[i].id);
    });
  });
});
