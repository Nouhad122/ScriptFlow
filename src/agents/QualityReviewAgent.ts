/**
 * QualityReviewAgent — evaluates a generated script against 10 quality criteria.
 *
 * Single responsibility: evaluate. This agent never rewrites, edits, or suggests
 * alternative wording. Its only output is a structured QualityReview.
 *
 * WHY THE AGENT OVERRIDES overallDecision:
 *   The AI returns an overallDecision, but the agent recomputes it programmatically.
 *   If any check has pass:false, the decision is HOLD — regardless of what the AI
 *   returned. This prevents subtle AI inconsistencies from allowing a failing script
 *   to slip through as PASS. The check data is the ground truth; the AI's conclusion
 *   is a useful signal but not the authority.
 *
 * WHY fabrication IS TREATED AS A BLOCKING FAILURE:
 *   A fabricated claim that reaches the client is worse than a weak hook that does not.
 *   If fabrication.pass is false, HOLD is the only valid outcome regardless of all
 *   other scores. The prompt instructs the AI to be strict on this criterion.
 *
 * HOW THE ORCHESTRATOR WILL USE THIS AGENT (Phase 7–10):
 *   const reviewResult = await qualityReviewAgent.reviewScript(script, idea, context);
 *   if (!reviewResult.success) { ... handle agent error }
 *   if (reviewResult.data.overallDecision === 'PASS') {
 *     await deliveryAgent.deliverScript(script, context);
 *   } else {
 *     // script is held — log heldReason, optionally regenerate
 *   }
 */

import { randomUUID } from 'crypto';
import type { IQualityReviewAgent } from './interfaces';
import type {
  AgentResult,
  ClientContext,
  Idea,
  Script,
  QualityReview,
  QualityChecks,
  QualityDecision,
  QualityScoreCheck,
  QualityBooleanCheck,
} from '../types';
import type { AIService } from '../services/AIService';
import { type QualityAgentConfig, qualityAgentConfig } from '../config/quality.config';
import { buildQualityReviewPrompt } from '../prompts/quality.prompt';

// ---------------------------------------------------------------------------
// Raw shape returned by the AI before validation and mapping
// ---------------------------------------------------------------------------

interface RawScoreCheck {
  pass: unknown;
  score: unknown;
  reason: unknown;
}

interface RawBooleanCheck {
  pass: unknown;
  reason: unknown;
}

interface RawChecks {
  hookStrength?: RawScoreCheck;
  problemClarity?: RawScoreCheck;
  storyFlow?: RawScoreCheck;
  solutionAlignment?: RawScoreCheck;
  proofAccuracy?: RawScoreCheck;
  ctaAlignment?: RawScoreCheck;
  brandVoice?: RawScoreCheck;
  fabrication?: RawBooleanCheck;
  length?: RawBooleanCheck;
  structure?: RawBooleanCheck;
}

interface RawQualityReview {
  overallDecision?: unknown;
  overallScore?: unknown;
  checks?: RawChecks;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function validateScoreCheck(raw: RawScoreCheck | undefined, name: string): QualityScoreCheck {
  if (!raw || typeof raw !== 'object') {
    throw new Error(`Quality check "${name}" is missing from the AI response`);
  }

  if (typeof raw.pass !== 'boolean') {
    throw new Error(`Quality check "${name}".pass must be a boolean. Got: ${typeof raw.pass}`);
  }

  const score = raw.score;
  if (!Number.isInteger(score) || (score as number) < 1 || (score as number) > 10) {
    throw new Error(
      `Quality check "${name}".score must be an integer between 1 and 10. Got: ${String(score)}`
    );
  }

  if (typeof raw.reason !== 'string' || (raw.reason as string).trim() === '') {
    throw new Error(`Quality check "${name}".reason is missing or empty`);
  }

  // Enforce score/pass consistency: score ≤ 5 must have pass:false
  const numScore = score as number;
  if (numScore <= 5 && raw.pass === true) {
    throw new Error(
      `Quality check "${name}" has score ${numScore} (≤5) but pass:true — these are contradictory`
    );
  }

  return {
    pass: raw.pass as boolean,
    score: numScore,
    reason: (raw.reason as string).trim(),
  };
}

function validateBooleanCheck(raw: RawBooleanCheck | undefined, name: string): QualityBooleanCheck {
  if (!raw || typeof raw !== 'object') {
    throw new Error(`Quality check "${name}" is missing from the AI response`);
  }

  if (typeof raw.pass !== 'boolean') {
    throw new Error(`Quality check "${name}".pass must be a boolean. Got: ${typeof raw.pass}`);
  }

  if (typeof raw.reason !== 'string' || (raw.reason as string).trim() === '') {
    throw new Error(`Quality check "${name}".reason is missing or empty`);
  }

  return {
    pass: raw.pass as boolean,
    reason: (raw.reason as string).trim(),
  };
}

function validateAndMapChecks(raw: RawChecks): QualityChecks {
  return {
    hookStrength:      validateScoreCheck(raw.hookStrength, 'hookStrength'),
    problemClarity:    validateScoreCheck(raw.problemClarity, 'problemClarity'),
    storyFlow:         validateScoreCheck(raw.storyFlow, 'storyFlow'),
    solutionAlignment: validateScoreCheck(raw.solutionAlignment, 'solutionAlignment'),
    proofAccuracy:     validateScoreCheck(raw.proofAccuracy, 'proofAccuracy'),
    ctaAlignment:      validateScoreCheck(raw.ctaAlignment, 'ctaAlignment'),
    brandVoice:        validateScoreCheck(raw.brandVoice, 'brandVoice'),
    fabrication:       validateBooleanCheck(raw.fabrication, 'fabrication'),
    length:            validateBooleanCheck(raw.length, 'length'),
    structure:         validateBooleanCheck(raw.structure, 'structure'),
  };
}

// ---------------------------------------------------------------------------
// Decision derivation — the agent is authoritative, not the AI's conclusion
// ---------------------------------------------------------------------------

function deriveDecision(checks: QualityChecks): QualityDecision {
  const allPass =
    checks.hookStrength.pass &&
    checks.problemClarity.pass &&
    checks.storyFlow.pass &&
    checks.solutionAlignment.pass &&
    checks.proofAccuracy.pass &&
    checks.ctaAlignment.pass &&
    checks.brandVoice.pass &&
    checks.fabrication.pass &&
    checks.length.pass &&
    checks.structure.pass;

  return allPass ? 'PASS' : 'HOLD';
}

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

export class QualityReviewAgent implements IQualityReviewAgent {
  private readonly ai: AIService;
  private readonly config: QualityAgentConfig;

  constructor(ai: AIService, config: QualityAgentConfig = qualityAgentConfig) {
    this.ai = ai;
    this.config = config;
  }

  async reviewScript(
    script: Script,
    idea: Idea,
    context: ClientContext
  ): Promise<AgentResult<QualityReview>> {
    const start = Date.now();

    try {
      const prompt = buildQualityReviewPrompt(script, idea, context);
      const raw = await this.ai.generateStructured<RawQualityReview>(prompt);

      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new Error(
          `Expected a JSON object from the AI but received: ${Array.isArray(raw) ? 'array' : typeof raw}`
        );
      }

      if (!raw.checks || typeof raw.checks !== 'object') {
        throw new Error('Quality review response is missing the "checks" object');
      }

      const overallScore = raw.overallScore;
      if (!Number.isInteger(overallScore) || (overallScore as number) < 0 || (overallScore as number) > 100) {
        throw new Error(
          `overallScore must be an integer between 0 and 100. Got: ${String(overallScore)}`
        );
      }

      const checks = validateAndMapChecks(raw.checks as RawChecks);

      // Derive decision from checks — override AI's conclusion if inconsistent
      const overallDecision = deriveDecision(checks);

      const review: QualityReview = {
        id: randomUUID(),
        scriptId: script.id,
        ideaId: script.ideaId,
        pipelineRunId: script.pipelineRunId,
        overallDecision,
        overallScore: overallScore as number,
        checks,
        createdAt: new Date(),
      };

      return {
        success: true,
        data: review,
        agentName: 'QualityReviewAgent',
        durationMs: Date.now() - start,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error in QualityReviewAgent',
        agentName: 'QualityReviewAgent',
        durationMs: Date.now() - start,
      };
    }
  }
}
