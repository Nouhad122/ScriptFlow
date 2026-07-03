import { describe, it, expect, vi } from 'vitest';
import { MemorySearchService, createMemorySearchService } from '../MemorySearchService';
import type { EmbeddingService } from '../EmbeddingService';
import type { MemoryRepository } from '../MemoryRepository';
import type { MemoryEntry } from '../types';
import { SimilaritySearch } from '../SimilaritySearch';
import type { ClientContext } from '../../types/client.types';

// ── Test vectors ──────────────────────────────────────────────────────────────
//
// All vectors are unit vectors (magnitude = 1.0).
// Cosine similarity with QUERY [1, 0, 0] equals the first component.
//
//   V_SIM_1_0: similarity = 1.00  (above threshold 0.60)
//   V_SIM_0_9: similarity ≈ 0.90  (above threshold 0.60)
//   V_SIM_0_8: similarity = 0.80  (above threshold 0.60)
//   V_SIM_0_7: similarity = 0.70  (above threshold 0.60 — was below old 0.75 threshold)
//   V_SIM_0_5: similarity = 0.50  (below threshold 0.60)
//   V_SIM_0_0: similarity = 0.00  (far below threshold)

const QUERY_VECTOR = [1, 0, 0];
const V_SIM_1_0   = [1, 0, 0];
const V_SIM_0_9   = [0.9, Math.sqrt(1 - 0.81), 0];   // |v| = 1.0, cos sim = 0.9
const V_SIM_0_8   = [0.8, 0.6, 0];                    // |v| = 1.0, cos sim = 0.8
const V_SIM_0_7   = [0.7, Math.sqrt(1 - 0.49), 0];   // |v| = 1.0, cos sim = 0.7
const V_SIM_0_5   = [0.5, Math.sqrt(1 - 0.25), 0];   // |v| = 1.0, cos sim = 0.5
const V_SIM_0_0   = [0, 1, 0];                        // |v| = 1.0, cos sim = 0.0

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_CONTEXT: ClientContext = {
  id: 'client-1',
  name: 'Test Client',
  niche: 'high-ticket online business coaching',
  avatars: [
    {
      name: 'Entrepreneur',
      pains: ['no time freedom', 'income ceiling'],
      desires: ['passive income', 'lifestyle business'],
    },
  ],
  brandVoice: {
    tone: 'direct and empowering',
    speakingStyle: 'conversational',
    doNotUse: ['hype', 'get-rich-quick'],
    referenceExamples: [],
  },
  proofBank: [],
  offerMechanics: {
    productName: 'Freedom Blueprint',
    price: '$5,000',
    guarantee: '30-day money-back',
    keyBenefits: ['time freedom', 'scalable income', 'proven system'],
    cta: 'Apply now',
  },
  portfolioSummary: 'Helped 200+ coaches scale to $10k/month within 90 days.',
  referencePackPath: '',
};

function makeEntry(
  id: string,
  sourceType: 'idea' | 'script',
  embedding: number[],
  text = `Text for entry ${id}`,
): MemoryEntry {
  return {
    id,
    sourceType,
    sourceId: `source-${id}`,
    clientId: 'client-1',
    pipelineRunId: 'run-1',
    text,
    embeddingModel: 'openai/text-embedding-3-small',
    embedding,
    createdAt: new Date(),
  };
}

function makeMockEmbeddingService(vector: number[] = QUERY_VECTOR) {
  return {
    embedText: vi.fn().mockResolvedValue(vector),
    embedIdea: vi.fn(),
    embedScript: vi.fn(),
    modelName: 'mock-model',
  } as unknown as EmbeddingService;
}

function makeMockRepository(entries: MemoryEntry[] = []) {
  return {
    getEntriesByClient: vi.fn().mockResolvedValue(entries),
    saveEntry: vi.fn(),
    ensureSchema: vi.fn(),
    getAllEntries: vi.fn(),
  } as unknown as MemoryRepository;
}

const realSearch = new SimilaritySearch();

function makeService(entries: MemoryEntry[] = [], queryVector = QUERY_VECTOR): MemorySearchService {
  return new MemorySearchService(
    makeMockEmbeddingService(queryVector),
    makeMockRepository(entries),
    realSearch,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('MemorySearchService.findSimilarContent', () => {
  // Test 1 — no memory entries → empty result
  it('returns an empty array when no memory entries exist for the client', async () => {
    const service = makeService([]);
    const result = await service.findSimilarContent(MOCK_CONTEXT);
    expect(result).toEqual([]);
  });

  // Test 2 — one match above threshold
  it('returns a match when one entry has similarity above the default threshold', async () => {
    const entry = makeEntry('e1', 'idea', V_SIM_1_0, 'Hook: Stop trading time for money\nAvatar: Entrepreneur');
    const service = makeService([entry]);

    const result = await service.findSimilarContent(MOCK_CONTEXT);

    expect(result).toHaveLength(1);
    expect(result[0].sourceType).toBe('idea');
    expect(result[0].sourceId).toBe('source-e1');
    expect(result[0].similarity).toBeCloseTo(1.0, 5);
    expect(result[0].text).toBe('Hook: Stop trading time for money\nAvatar: Entrepreneur');
  });

  // Test 3 — threshold filtering: only entries ≥ 0.60 are returned
  it('excludes entries whose similarity score is below 0.60', async () => {
    const above = makeEntry('above', 'idea', V_SIM_0_7, 'Hook: Fire your boss');
    const below = makeEntry('below', 'script', V_SIM_0_5, 'Hook: Something tried before');
    const service = makeService([above, below]);

    const result = await service.findSimilarContent(MOCK_CONTEXT);

    expect(result).toHaveLength(1);
    expect(result[0].sourceId).toBe('source-above');
  });

  // Test 4 — top-K ordering: sorted descending, capped at topK
  it('returns matches sorted by similarity descending, limited to topK', async () => {
    const entries = [
      makeEntry('low',  'idea',   V_SIM_0_8),   // 0.80
      makeEntry('high', 'idea',   V_SIM_1_0),   // 1.00
      makeEntry('mid',  'script', V_SIM_0_9),   // ~0.90
    ];
    const service = makeService(entries);

    const result = await service.findSimilarContent(MOCK_CONTEXT, 2);

    expect(result).toHaveLength(2);
    expect(result[0].similarity).toBeGreaterThan(result[1].similarity);
    expect(result[0].sourceId).toBe('source-high');
    expect(result[1].sourceId).toBe('source-mid');
  });

  // Test 5 — all entries below threshold → empty result
  it('returns an empty array when all entries fall below the threshold', async () => {
    const entries = [
      makeEntry('a', 'idea',   V_SIM_0_5),
      makeEntry('b', 'script', V_SIM_0_0),
    ];
    const service = makeService(entries);

    const result = await service.findSimilarContent(MOCK_CONTEXT);

    expect(result).toEqual([]);
  });

  // Test 6 — error propagation (pipeline catches this; see PipelineOrchestrator memory search stage)
  it('propagates embedding errors so the orchestrator try/catch can handle them', async () => {
    const embedSvc = {
      embedText: vi.fn().mockRejectedValue(new Error('OpenRouter embedding failed')),
      modelName: 'mock-model',
    } as unknown as EmbeddingService;
    const service = new MemorySearchService(embedSvc, makeMockRepository([]), realSearch);

    await expect(service.findSimilarContent(MOCK_CONTEXT)).rejects.toThrow('OpenRouter embedding failed');
  });

  // Test 7 — MemoryMatch shape
  it('maps results to the MemoryMatch shape with sourceType, sourceId, similarity, aboveThreshold, and text', async () => {
    const entry = makeEntry('e2', 'script', V_SIM_0_8, 'Hook: What if you could fire your boss?');
    const service = makeService([entry]);

    const result = await service.findSimilarContent(MOCK_CONTEXT);

    expect(result[0]).toEqual({
      sourceType: 'script',
      sourceId: 'source-e2',
      similarity: expect.any(Number),
      aboveThreshold: true,
      text: 'Hook: What if you could fire your boss?',
    });
    expect(result[0].similarity).toBeCloseTo(0.8, 5);
    expect(result[0].aboveThreshold).toBe(true);
  });
});

// ── createMemorySearchService ─────────────────────────────────────────────────

describe('createMemorySearchService', () => {
  it('returns null for an empty key', () => {
    expect(createMemorySearchService('')).toBeNull();
  });

  it('returns null for a whitespace-only key', () => {
    expect(createMemorySearchService('   ')).toBeNull();
  });

  it('returns a MemorySearchService instance for a non-empty key', () => {
    const result = createMemorySearchService('sk-or-test-key-not-real');
    expect(result).toBeInstanceOf(MemorySearchService);
  });
});
