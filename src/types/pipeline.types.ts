import type { Idea } from './idea.types';

/**
 * AgentResult<T> is the standard return type for every agent method.
 *
 * It is a discriminated union — TypeScript will force every caller to check
 * `.success` before accessing `.data`. This makes error handling explicit
 * and prevents silent failures from propagating through the pipeline.
 *
 * Usage:
 *   const result = await ideaAgent.generateIdeas(context, []);
 *   if (!result.success) {
 *     // handle error — result.error is available here
 *   }
 *   // result.data is safely available here
 */
export type AgentResult<T> =
  | {
      success: true;
      data: T;
      agentName: string;
      durationMs: number;
    }
  | {
      success: false;
      error: string;
      agentName: string;
      durationMs: number;
    };

/**
 * PipelineSummary is the per-run breakdown of ICE recommendations.
 * "Candidates" refers to the AI's recommendation, not the human's approval decision.
 * At the time the pipeline completes, all ideas are still pending human review.
 */
export interface PipelineSummary {
  totalIdeas: number;
  approvedCandidates: number;
  considerCandidates: number;
  rejectedCandidates: number;
}

/**
 * PipelineTimings breaks down wall-clock time per stage.
 * Used for debugging (which stage is slow?) and cost attribution (longer AI
 * calls = higher spend). The orchestrator records each stage independently.
 */
export interface PipelineTimings {
  memorySearchMs: number;
  ideaGenerationMs: number;
  iceScoringMs: number;
  persistenceMs: number;
  totalMs: number;
}

/**
 * PipelineRunResult is the discriminated union returned by
 * PipelineOrchestrator.generateAndScoreIdeas().
 *
 * On failure, failedStage identifies exactly which stage broke so callers can
 * report meaningfully (e.g. "ICE Scoring failed") rather than a generic error.
 */
export type PipelineRunResult =
  | {
      success: true;
      pipelineRunId: string;
      generatedAt: Date;
      clientId: string;
      summary: PipelineSummary;
      timings: PipelineTimings;
      ideas: Idea[];
    }
  | {
      success: false;
      pipelineRunId: string;
      failedStage: string;
      error: string;
    };

