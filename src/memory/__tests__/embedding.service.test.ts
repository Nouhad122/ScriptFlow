import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmbeddingService } from '../EmbeddingService';
import type { IEmbeddingProvider } from '../EmbeddingProvider';
import type { Idea } from '../../types/idea.types';
import type { Script } from '../../types/script.types';

const MOCK_VECTOR = [0.1, 0.2, 0.3];

const mockProvider: IEmbeddingProvider = {
  modelName: 'mock-embed-v1',
  embed: vi.fn().mockResolvedValue(MOCK_VECTOR),
  embedBatch: vi.fn().mockResolvedValue([MOCK_VECTOR]),
};

const testIdea: Idea = {
  id: 'idea-1',
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
  approvalStatus: 'pending',
  approvedAt: null,
  approvedBy: null,
  createdAt: new Date(),
};

const testIdeaNoProof: Idea = {
  ...testIdea,
  id: 'idea-no-proof',
  supportingProofPoints: [],
};

const testScript: Script = {
  id: 'script-1',
  ideaId: 'idea-1',
  clientId: 'client-1',
  pipelineRunId: 'run-1',
  hook1: 'What if you could fire your boss?',
  hook2: 'Most people work 40 years for someone else.',
  hook3: 'The secret the 9-to-5 never tells you.',
  body: {
    problem: 'You work harder each year but freedom feels further away.',
    story: 'My client Sarah felt exactly this — until one system change.',
    solution: 'We built her a client pipeline that runs without her.',
    proof: 'She went from 60-hour weeks to 20 in 90 days.',
    cta: "Comment FREEDOM and I'll send you the exact framework.",
  },
  productionNotes: 'Shoot at desk. Natural lighting.',
  status: 'pending_review',
  deliveredAt: null,
  outputPath: null,
  createdAt: new Date(),
};

function lastEmbedArg(): string {
  return (mockProvider.embed as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0] as string;
}

describe('EmbeddingService', () => {
  const service = new EmbeddingService(mockProvider);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes the provider model name', () => {
    expect(service.modelName).toBe('mock-embed-v1');
  });

  // ── embedIdea ──────────────────────────────────────────────────────────────

  describe('embedIdea', () => {
    it('returns the vector from the provider', async () => {
      const result = await service.embedIdea(testIdea);
      expect(result).toEqual(MOCK_VECTOR);
    });

    it('calls provider.embed exactly once', async () => {
      await service.embedIdea(testIdea);
      expect(mockProvider.embed).toHaveBeenCalledOnce();
    });

    it('includes hookLine in the composed text', async () => {
      await service.embedIdea(testIdea);
      expect(lastEmbedArg()).toContain('Stop trading time for money');
    });

    it('includes targetAvatar in the composed text', async () => {
      await service.embedIdea(testIdea);
      expect(lastEmbedArg()).toContain('Stuck 9-to-5 worker');
    });

    it('includes targetPain in the composed text', async () => {
      await service.embedIdea(testIdea);
      expect(lastEmbedArg()).toContain('No control over time or income');
    });

    it('includes creativeType and leadType', async () => {
      await service.embedIdea(testIdea);
      const text = lastEmbedArg();
      expect(text).toContain('talking-head');
      expect(text).toContain('problem-led');
    });

    it('includes supportingProofPoints when present', async () => {
      await service.embedIdea(testIdea);
      expect(lastEmbedArg()).toContain('200 clients helped');
    });

    it('omits the Proof line when supportingProofPoints is empty', async () => {
      await service.embedIdea(testIdeaNoProof);
      expect(lastEmbedArg()).not.toContain('Proof:');
    });
  });

  // ── embedScript ────────────────────────────────────────────────────────────

  describe('embedScript', () => {
    it('returns the vector from the provider', async () => {
      const result = await service.embedScript(testScript);
      expect(result).toEqual(MOCK_VECTOR);
    });

    it('calls provider.embed exactly once', async () => {
      await service.embedScript(testScript);
      expect(mockProvider.embed).toHaveBeenCalledOnce();
    });

    it('includes hook1 in the composed text', async () => {
      await service.embedScript(testScript);
      expect(lastEmbedArg()).toContain('What if you could fire your boss?');
    });

    it('includes body.problem in the composed text', async () => {
      await service.embedScript(testScript);
      expect(lastEmbedArg()).toContain('You work harder each year');
    });

    it('includes body.solution in the composed text', async () => {
      await service.embedScript(testScript);
      expect(lastEmbedArg()).toContain('We built her a client pipeline');
    });

    it('includes body.cta in the composed text', async () => {
      await service.embedScript(testScript);
      expect(lastEmbedArg()).toContain('Comment FREEDOM');
    });

    it('does NOT include hook2 or hook3 — only the primary hook', async () => {
      await service.embedScript(testScript);
      const text = lastEmbedArg();
      expect(text).not.toContain('Most people work 40 years');
      expect(text).not.toContain('The secret the 9-to-5');
    });
  });
});
