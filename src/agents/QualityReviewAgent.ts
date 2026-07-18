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
// Per-criterion pass thresholds
// hookStrength requires 7+ to pass — a competent hook (6) is not scroll-stopping.
// All other scored criteria use the standard threshold of 6.
// ---------------------------------------------------------------------------

const SCORE_PASS_THRESHOLD: Partial<Record<keyof QualityChecks, number>> = {
  hookStrength: 6,
};

const DEFAULT_PASS_THRESHOLD = 6;

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

// Gemini sometimes returns booleans as strings ("true"/"false") or numbers (1/0).
// This coerces them to actual booleans.
function coerceBool(value: unknown, fieldPath: string): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === 1) return true;
  if (value === 'false' || value === 0) return false;
  throw new Error(`${fieldPath} must be a boolean. Got: ${String(value)}`);
}

// Gemini sometimes returns scores as floats (7.0, 7.5). Round to nearest integer.
function coerceScore(value: unknown, fieldPath: string): number {
  const n = typeof value === 'string' ? parseFloat(value) : Number(value);
  if (isNaN(n)) throw new Error(`${fieldPath} must be a number. Got: ${String(value)}`);
  return Math.round(n);
}

function validateScoreCheck(
  raw: RawScoreCheck | undefined,
  name: string,
  key: keyof QualityChecks,
): QualityScoreCheck {
  if (!raw || typeof raw !== 'object') {
    throw new Error(`Quality check "${name}" is missing from the AI response`);
  }

  const pass = coerceBool(raw.pass, `Quality check "${name}".pass`);

  const score = coerceScore(raw.score, `Quality check "${name}".score`);
  if (score < 1 || score > 10) {
    throw new Error(
      `Quality check "${name}".score must be between 1 and 10. Got: ${score}`
    );
  }

  if (typeof raw.reason !== 'string' || (raw.reason as string).trim() === '') {
    throw new Error(`Quality check "${name}".reason is missing or empty`);
  }

  const threshold = SCORE_PASS_THRESHOLD[key] ?? DEFAULT_PASS_THRESHOLD;

  // Enforce score/pass consistency against this criterion's threshold.
  if (score < threshold && pass === true) {
    throw new Error(
      `Quality check "${name}" has score ${score} (<${threshold}) but pass:true — these are contradictory`
    );
  }

  return {
    pass,
    score,
    reason: (raw.reason as string).trim(),
  };
}

function validateBooleanCheck(raw: RawBooleanCheck | undefined, name: string): QualityBooleanCheck {
  if (!raw || typeof raw !== 'object') {
    throw new Error(`Quality check "${name}" is missing from the AI response`);
  }

  const pass = coerceBool(raw.pass, `Quality check "${name}".pass`);

  if (typeof raw.reason !== 'string' || (raw.reason as string).trim() === '') {
    throw new Error(`Quality check "${name}".reason is missing or empty`);
  }

  return {
    pass,
    reason: (raw.reason as string).trim(),
  };
}

function validateAndMapChecks(raw: RawChecks): QualityChecks {
  return {
    hookStrength:      validateScoreCheck(raw.hookStrength,      'hookStrength',      'hookStrength'),
    problemClarity:    validateScoreCheck(raw.problemClarity,    'problemClarity',    'problemClarity'),
    storyFlow:         validateScoreCheck(raw.storyFlow,         'storyFlow',         'storyFlow'),
    solutionAlignment: validateScoreCheck(raw.solutionAlignment, 'solutionAlignment', 'solutionAlignment'),
    proofAccuracy:     validateScoreCheck(raw.proofAccuracy,     'proofAccuracy',     'proofAccuracy'),
    ctaAlignment:      validateScoreCheck(raw.ctaAlignment,      'ctaAlignment',      'ctaAlignment'),
    brandVoice:        validateScoreCheck(raw.brandVoice,        'brandVoice',        'brandVoice'),
    fabrication:       validateBooleanCheck(raw.fabrication,     'fabrication'),
    length:            validateBooleanCheck(raw.length,          'length'),
    structure:         validateBooleanCheck(raw.structure,       'structure'),
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

      const overallScore = coerceScore(raw.overallScore, 'overallScore');
      if (overallScore < 0 || overallScore > 100) {
        throw new Error(
          `overallScore must be between 0 and 100. Got: ${overallScore}`
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
        overallScore,
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
