import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryWriteService, createMemoryWriteService } from '../MemoryWriteService';
import type { EmbeddingService } from '../EmbeddingService';
import type { MemoryRepository } from '../MemoryRepository';
import type { MemoryEntry } from '../types';
import type { Idea } from '../../types/idea.types';
import type { Script } from '../../types/script.types';

// ── Test fixtures ─────────────────────────────────────────────────────────────

const testIdea: Idea = {
  id: 'idea-abc123',
  clientId: 'client-1',
  pipelineRunId: 'run-1',
  hookLine: 'Stop trading time for money',
  creativeType: 'talking-head',
  angle: 'freedom through systems',
  leadType: 'problem-led',
  supportingProofPoints: ['200 clients helped', '$10k/month average'],
  targetAvatar: 'Stuck 9-to-5 worker',
  targetPain: 'No control over time or income',
  iceScore: null,
  approvalStatus: 'approved',
  approvedAt: new Date(),
  approvedBy: 'manual',
  createdAt: new Date(),
};

const testScript: Script = {
  id: 'script-xyz789',
  ideaId: 'idea-abc123',
  clientId: 'client-1',
  pipelineRunId: 'run-1',
  hook1: 'What if you could fire your boss?',
  hook2: 'Most people work 40 years for someone else.',
  hook3: 'The secret the 9-to-5 never tells you.',
  body: {
    problem: 'You work harder each year but freedom feels further away.',
    story: 'My client Sarah felt exactly this until one system change.',
    solution: 'We built her a client pipeline that runs without her.',
    proof: 'She went from 60-hour weeks to 20 in 90 days.',
    cta: 'Comment FREEDOM and I will send you the exact framework.',
  },
  productionNotes: 'Shoot at desk. Natural lighting.',
  status: 'pending_review',
  deliveredAt: null,
  outputPath: null,
  createdAt: new Date(),
};

const MOCK_IDEA_VECTOR = [0.1, 0.2, 0.3];
const MOCK_SCRIPT_VECTOR = [0.4, 0.5, 0.6];

// ── Mock builders ─────────────────────────────────────────────────────────────

function makeMockEmbeddingService() {
  return {
    modelName: 'mock-embed-v1',
    embedIdea: vi.fn().mockResolvedValue(MOCK_IDEA_VECTOR),
    embedScript: vi.fn().mockResolvedValue(MOCK_SCRIPT_VECTOR),
  } as unknown as EmbeddingService;
}

function makeMockRepository(overrides: Partial<MemoryRepository> = {}) {
  return {
    saveEntry: vi.fn().mockResolvedValue(undefined),
    ensureSchema: vi.fn().mockResolvedValue(undefined),
    getAllEntries: vi.fn().mockResolvedValue([]),
    getEntriesByClient: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as MemoryRepository;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('MemoryWriteService.rememberApprovedIdea', () => {
  let embedSvc: EmbeddingService;
  let repo: MemoryRepository;
  let service: MemoryWriteService;

  beforeEach(() => {
    embedSvc = makeMockEmbeddingService();
    repo = makeMockRepository();
    service = new MemoryWriteService(embedSvc, repo);
  });

  it('calls embedIdea with the idea', async () => {
    await service.rememberApprovedIdea(testIdea);
    expect(embedSvc.embedIdea).toHaveBeenCalledWith(testIdea);
  });

  it('saves an entry with sourceType "idea" and the idea id as sourceId', async () => {
    await service.rememberApprovedIdea(testIdea);
    const saved = (repo.saveEntry as ReturnType<typeof vi.fn>).mock.calls[0][0] as MemoryEntry;
    expect(saved.sourceType).toBe('idea');
    expect(saved.sourceId).toBe('idea-abc123');
  });

  it('saves an entry with correct clientId, pipelineRunId, embeddingModel, and embedding', async () => {
    await service.rememberApprovedIdea(testIdea);
    const saved = (repo.saveEntry as ReturnType<typeof vi.fn>).mock.calls[0][0] as MemoryEntry;
    expect(saved.clientId).toBe('client-1');
    expect(saved.pipelineRunId).toBe('run-1');
    expect(saved.embeddingModel).toBe('mock-embed-v1');
    expect(saved.embedding).toEqual(MOCK_IDEA_VECTOR);
  });

  it('stores a text field that contains the hookLine', async () => {
    await service.rememberApprovedIdea(testIdea);
    const saved = (repo.saveEntry as ReturnType<typeof vi.fn>).mock.calls[0][0] as MemoryEntry;
    expect(saved.text).toContain('Stop trading time for money');
  });

  it('stores a text field that contains avatar and pain', async () => {
    await service.rememberApprovedIdea(testIdea);
    const saved = (repo.saveEntry as ReturnType<typeof vi.fn>).mock.calls[0][0] as MemoryEntry;
    expect(saved.text).toContain('Stuck 9-to-5 worker');
    expect(saved.text).toContain('No control over time or income');
  });

  it('assigns a non-empty UUID as the entry id', async () => {
    await service.rememberApprovedIdea(testIdea);
    const saved = (repo.saveEntry as ReturnType<typeof vi.fn>).mock.calls[0][0] as MemoryEntry;
    expect(saved.id).toBeTruthy();
    expect(saved.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  // ── Test 5: memory failure must not propagate ───────────────────────────────

  it('does not throw when embedIdea rejects', async () => {
    (embedSvc.embedIdea as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('OpenRouter embedding failed'),
    );
    await expect(service.rememberApprovedIdea(testIdea)).resolves.toBeUndefined();
  });

  it('does not throw when saveEntry rejects', async () => {
    (repo.saveEntry as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('UNIQUE constraint failed: memory_entries.source_type, memory_entries.source_id'),
    );
    await expect(service.rememberApprovedIdea(testIdea)).resolves.toBeUndefined();
  });
});

// ── rememberGeneratedScript ───────────────────────────────────────────────────

describe('MemoryWriteService.rememberGeneratedScript', () => {
  let embedSvc: EmbeddingService;
  let repo: MemoryRepository;
  let service: MemoryWriteService;

  beforeEach(() => {
    embedSvc = makeMockEmbeddingService();
    repo = makeMockRepository();
    service = new MemoryWriteService(embedSvc, repo);
  });

  it('calls embedScript with the script', async () => {
    await service.rememberGeneratedScript(testScript, testIdea);
    expect(embedSvc.embedScript).toHaveBeenCalledWith(testScript);
  });

  it('saves an entry with sourceType "script" and the script id as sourceId', async () => {
    await service.rememberGeneratedScript(testScript, testIdea);
    const saved = (repo.saveEntry as ReturnType<typeof vi.fn>).mock.calls[0][0] as MemoryEntry;
    expect(saved.sourceType).toBe('script');
    expect(saved.sourceId).toBe('script-xyz789');
  });

  it('saves an entry with correct embedding and model', async () => {
    await service.rememberGeneratedScript(testScript, testIdea);
    const saved = (repo.saveEntry as ReturnType<typeof vi.fn>).mock.calls[0][0] as MemoryEntry;
    expect(saved.embedding).toEqual(MOCK_SCRIPT_VECTOR);
    expect(saved.embeddingModel).toBe('mock-embed-v1');
  });

  it('uses script.clientId when present', async () => {
    await service.rememberGeneratedScript(testScript, testIdea);
    const saved = (repo.saveEntry as ReturnType<typeof vi.fn>).mock.calls[0][0] as MemoryEntry;
    expect(saved.clientId).toBe('client-1');
  });

  it('falls back to idea.clientId when script.clientId is empty', async () => {
    const scriptNoClient = { ...testScript, clientId: '' };
    await service.rememberGeneratedScript(scriptNoClient, testIdea);
    const saved = (repo.saveEntry as ReturnType<typeof vi.fn>).mock.calls[0][0] as MemoryEntry;
    expect(saved.clientId).toBe('client-1');
  });

  it('stores a text field that contains hook1 and the CTA', async () => {
    await service.rememberGeneratedScript(testScript, testIdea);
    const saved = (repo.saveEntry as ReturnType<typeof vi.fn>).mock.calls[0][0] as MemoryEntry;
    expect(saved.text).toContain('What if you could fire your boss?');
    expect(saved.text).toContain('Comment FREEDOM');
  });

  // ── Test 5: memory failure must not propagate ───────────────────────────────

  it('does not throw when embedScript rejects', async () => {
    (embedSvc.embedScript as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('OpenRouter rate limit exceeded'),
    );
    await expect(
      service.rememberGeneratedScript(testScript, testIdea),
    ).resolves.toBeUndefined();
  });
});

// ── Duplicate prevention ──────────────────────────────────────────────────────

describe('duplicate prevention', () => {
  it('does not throw when saveEntry rejects with a UNIQUE constraint violation', async () => {
    const repo = makeMockRepository({
      saveEntry: vi.fn().mockRejectedValue(
        new Error('UNIQUE constraint failed: memory_entries.source_type, memory_entries.source_id'),
      ),
    });
    const service = new MemoryWriteService(makeMockEmbeddingService(), repo);

    // Both calls resolve — the constraint violation is swallowed
    await expect(service.rememberApprovedIdea(testIdea)).resolves.toBeUndefined();
    await expect(service.rememberGeneratedScript(testScript, testIdea)).resolves.toBeUndefined();
  });
});

// ── Missing VOYAGE_API_KEY ────────────────────────────────────────────────────

describe('createMemoryWriteService', () => {
  it('returns null when the key is an empty string', () => {
    const result = createMemoryWriteService('');
    expect(result).toBeNull();
  });

  it('returns null when the key is only whitespace', () => {
    const result = createMemoryWriteService('   ');
    expect(result).toBeNull();
  });

  it('returns a MemoryWriteService instance when a non-empty key is provided', () => {
    // A non-empty key passes validation; OpenRouter client is created but not called.
    // We do not make real API calls in unit tests.
    const result = createMemoryWriteService('sk-or-test-key-not-real');
    expect(result).toBeInstanceOf(MemoryWriteService);
  });
});
