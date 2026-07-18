/**
 * IceScoringAgent — evaluates generated ideas using the ICE framework.
 *
 * Single responsibility: attach a validated IceScore to every Idea it receives.
 * This agent does NOT generate ideas, scripts, or perform quality reviews.
 *
 * WHY SCORING IS A SEPARATE AGENT (not part of IdeaAgent):
 *   Idea generation and idea evaluation are opposite cognitive modes.
 *   Generation is creative and expansive; scoring is analytical and critical.
 *   Keeping them as separate agents means:
 *     - The scoring rubric can evolve without touching idea generation logic.
 *     - Temperature settings are independent (0.3 for scoring, 1 for generation).
 *     - If scoring fails, the generated ideas are not lost — they can be retried.
 *     - Ideas can be re-scored in the future with a different model or rubric.
 *
 * WHY REASONING STRINGS ARE MANDATORY, NOT OPTIONAL:
 *   Numbers without explanations are useless to a human reviewer.
 *   "Impact: 9" is meaningless. "Impact: 9 — this concept directly targets the
 *   avatar's stated pain of feeling underpaid and connects to the proof bank's
 *   strongest result" gives the reviewer something to agree or override with
 *   informed judgment. Reasoning is what makes human approval actionable.
 *
 * HOW THE ORCHESTRATOR WILL USE THIS AGENT:
 *   const ideasResult = await ideaAgent.generateIdeas(context, previousIdeas);
 *   if (!ideasResult.success) { ... handle error }
 *   const scoredResult = await iceScoringAgent.scoreIdeas(ideasResult.data, context);
 *   if (!scoredResult.success) { ... handle error }
 *   await memoryAgent.storeIdeas(scoredResult.data);
 *   // ideas now have iceScore populated and are ready for the dashboard
 */

import type { IIceScoringAgent } from './interfaces';
import type { AgentResult, ClientContext, Idea, IceScore, IceRecommendation } from '../types';
import type { AIService } from '../services/AIService';
import { type IceAgentConfig, iceAgentConfig } from '../config/ice.config';
import { buildIceScoringPrompt } from '../prompts/ice.prompt';

// ---------------------------------------------------------------------------
// Raw shape returned by the AI — includes ideaId for matching back to ideas.
// ---------------------------------------------------------------------------

interface RawScoreFromAI {
  ideaId: string;
  impact: number;
  impactReason: string;
  confidence: number;
  confidenceReason: string;
  ease: number;
  easeReason: string;
  overallReasoning: string;
  recommendation: string;
}

const VALID_RECOMMENDATIONS = new Set<string>(['APPROVE', 'CONSIDER', 'REJECT']);

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateScore(score: number, fieldName: string, index: number): void {
  if (!Number.isInteger(score) || score < 1 || score > 10) {
    throw new Error(
      `Score at index ${index}: "${fieldName}" must be an integer between 1 and 10. Got: ${score}`
    );
  }
}

function validateRawScores(raw: unknown, ideaIds: Set<string>): RawScoreFromAI[] {
  if (!Array.isArray(raw)) {
    throw new Error(`Expected a JSON array from the AI but received: ${typeof raw}`);
  }
  if (raw.length === 0) {
    throw new Error('AI returned an empty scores array');
  }

  const seenIds = new Set<string>();

  for (let i = 0; i < raw.length; i++) {
    const item = raw[i] as Record<string, unknown>;

    // ideaId must match one of the input ideas
    const ideaId = item.ideaId;
    if (!ideaId || typeof ideaId !== 'string') {
      throw new Error(`Score at index ${i}: missing or invalid "ideaId"`);
    }
    if (!ideaIds.has(ideaId)) {
      throw new Error(`Score at index ${i}: "ideaId" "${ideaId}" does not match any input idea`);
    }
    if (seenIds.has(ideaId)) {
      // AI returned this ideaId twice. Discard the second entry — the first score
      // is already recorded. If the AI omitted a different idea and substituted it
      // with this duplicate, the "every input idea must have a score" check below
      // will still catch it and fail correctly.
      continue;
    }
    seenIds.add(ideaId);

    // Numeric score validation
    validateScore(item.impact as number, 'impact', i);
    validateScore(item.confidence as number, 'confidence', i);
    validateScore(item.ease as number, 'ease', i);

    // Reason strings must be present and non-empty
    const reasonFields = ['impactReason', 'confidenceReason', 'easeReason', 'overallReasoning'];
    for (const field of reasonFields) {
      const value = item[field];
      if (!value || typeof value !== 'string' || value.trim() === '') {
        throw new Error(`Score at index ${i}: "${field}" is missing or empty`);
      }
    }

    // Recommendation must be one of the three allowed values
    if (!VALID_RECOMMENDATIONS.has(item.recommendation as string)) {
      throw new Error(
        `Score at index ${i}: invalid "recommendation" "${item.recommendation}". ` +
          `Allowed values: ${[...VALID_RECOMMENDATIONS].join(', ')}`
      );
    }
  }

  // Every input idea must have received a score
  for (const id of ideaIds) {
    if (!seenIds.has(id)) {
      throw new Error(`No score returned for idea with id "${id}"`);
    }
  }

  return raw as RawScoreFromAI[];
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

function mapToIceScore(raw: RawScoreFromAI): IceScore {
  return {
    impact: raw.impact,
    impactReason: raw.impactReason,
    confidence: raw.confidence,
    confidenceReason: raw.confidenceReason,
    ease: raw.ease,
    easeReason: raw.easeReason,
    overallReasoning: raw.overallReasoning,
    recommendation: raw.recommendation as IceRecommendation,
  };
}

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

export class IceScoringAgent implements IIceScoringAgent {
  private readonly ai: AIService;
  private readonly config: IceAgentConfig;

  constructor(ai: AIService, config: IceAgentConfig = iceAgentConfig) {
    this.ai = ai;
    this.config = config;
  }

  async scoreIdeas(ideas: Idea[], context: ClientContext): Promise<AgentResult<Idea[]>> {
    const start = Date.now();

    try {
      if (ideas.length === 0) {
        throw new Error('IceScoringAgent received an empty ideas array');
      }

      const prompt = buildIceScoringPrompt(ideas, context);
      const ideaIds = new Set(ideas.map((i) => i.id));

      const raw = await this.ai.generateStructured<RawScoreFromAI[]>(prompt);
      const validated = validateRawScores(raw, ideaIds);

      // Build a lookup map so order returned by AI doesn't matter
      const scoreMap = new Map(validated.map((s) => [s.ideaId, mapToIceScore(s)]));

      const scoredIdeas: Idea[] = ideas.map((idea) => ({
        ...idea,
        iceScore: scoreMap.get(idea.id) ?? null,
      }));

      return {
        success: true,
        data: scoredIdeas,
        agentName: 'IceScoringAgent',
        durationMs: Date.now() - start,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error in IceScoringAgent',
        agentName: 'IceScoringAgent',
        durationMs: Date.now() - start,
      };
    }
  }
}
