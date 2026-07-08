/**
 * PipelineOrchestrator — the central coordinator of the ScriptFlow AI system.
 *
 * DESIGN RULES (enforced here, not assumed):
 *
 *   1. This class NEVER calls AIService or OpenRouter directly.
 *   2. This class NEVER contains prompt text.
 *   3. This class NEVER duplicates logic that belongs to an agent.
 *   4. Its only job is: sequence agents, check results, assign IDs, aggregate data.
 *
 * WHY ORCHESTRATION IS SEPARATE FROM GENERATION:
 *   If this class also held prompts or model config, a change to the scoring rubric
 *   would require touching the coordinator — risking unintended side effects on
 *   pipeline control flow. Separation means each piece can change without breaking
 *   the others. An agent that changes from DeepSeek to Claude touches one file:
 *   the agent. The orchestrator is unaffected.
 *
 * WHY AGENTS ARE INDEPENDENT OF EACH OTHER:
 *   IdeaAgent does not call IceScoringAgent. Each agent is a pure input→output
 *   function that knows nothing about what comes before or after it. This means:
 *   - Any agent can be tested without the full pipeline.
 *   - The orchestrator controls stage ordering; agents never do.
 *   - Agents can be reused in standalone endpoints (e.g. /api/ideas/score).
 *   - The orchestrator can run two scoring agents in parallel or A/B test them
 *     without touching either agent.
 *
 * WHY pipelineRunId IS ASSIGNED HERE (NOT IN IdeaAgent):
 *   The pipelineRunId represents this particular execution of the pipeline.
 *   IdeaAgent doesn't know it's part of a pipeline — it generates ideas.
 *   The orchestrator generates one UUID and stamps every idea before they are
 *   scored or persisted. This keeps IdeaAgent reusable in contexts that have
 *   no pipeline concept (the standalone /api/ideas/generate endpoint).
 */

import { randomUUID } from 'crypto';
import type {
  ClientContext,
  Idea,
  PipelineRunResult,
  PipelineSummary,
  PipelineTimings,
} from '../types';
import type {
  IIceScoringAgent,
  IIdeaAgent,
} from '../agents/interfaces';
import { saveIdeas } from '../database/ideas.repository';
import { savePipelineRun } from '../database/pipeline.repository';
import type { PipelineRunRecord } from '../database/pipeline.repository';
import type { MemoryMatch } from '../memory/types';
import type { MemorySearchService } from '../memory/MemorySearchService';

export class PipelineOrchestrator {
  private readonly ideaAgent: IIdeaAgent;
  private readonly iceScoringAgent: IIceScoringAgent;
  private readonly memorySearchService?: MemorySearchService;

  constructor(
    ideaAgent: IIdeaAgent,
    iceScoringAgent: IIceScoringAgent,
    memorySearchService?: MemorySearchService,
  ) {
    this.ideaAgent = ideaAgent;
    this.iceScoringAgent = iceScoringAgent;
    this.memorySearchService = memorySearchService;
  }

  // ---------------------------------------------------------------------------
  // Logging
  // ---------------------------------------------------------------------------

  private log(pipelineRunId: string, stage: string, elapsedMs?: number): void {
    const timing = elapsedMs !== undefined ? ` (${elapsedMs}ms)` : '';
    console.log(`[Pipeline ${pipelineRunId}] ${stage}${timing}`);
  }

  // ---------------------------------------------------------------------------
  // Stage 1 — Generate, score, and save ideas
  // ---------------------------------------------------------------------------

  // Persists the run record non-fatally so a DB error never breaks the live pipeline.
  private async persistRun(run: PipelineRunRecord): Promise<void> {
    await savePipelineRun(run).catch((err) => {
      console.error(`[Pipeline ${run.id}] Failed to persist run record:`, err);
    });
  }

  async generateAndScoreIdeas(clientContext: ClientContext): Promise<PipelineRunResult> {
    const pipelineRunId = randomUUID();
    const pipelineStart = Date.now();

    // Hoisted so every exit branch can read the timings recorded so far.
    let memorySearchMs = 0;
    let ideaGenerationMs = 0;
    let iceScoringMs = 0;
    let persistenceMs = 0;

    this.log(pipelineRunId, 'Pipeline started');

    // ── Memory Search ─────────────────────────────────────────────────────────
    // Non-blocking: failures are logged and the pipeline continues with no context.

    let memoryMatches: MemoryMatch[] = [];

    if (this.memorySearchService) {
      const memSearchStart = Date.now();
      this.log(pipelineRunId, 'MemorySearch started');
      try {
        memoryMatches = await this.memorySearchService.findSimilarContent(clientContext);
        memorySearchMs = Date.now() - memSearchStart;
        this.log(
          pipelineRunId,
          `MemorySearch completed — ${memoryMatches.length} match${memoryMatches.length === 1 ? '' : 'es'} found`,
          memorySearchMs
        );
      } catch (err) {
        memorySearchMs = Date.now() - memSearchStart;
        console.error(
          `[Pipeline ${pipelineRunId}] Memory search failed:`,
          err instanceof Error ? err.message : String(err)
        );
        this.log(pipelineRunId, 'MemorySearch failed — continuing without context', memorySearchMs);
      }
    }

    // ── Idea Generation ───────────────────────────────────────────────────────

    const ideaStart = Date.now();
    this.log(pipelineRunId, 'IdeaGeneration started');

    const ideasResult = await this.ideaAgent.generateIdeas(clientContext, [], memoryMatches);
    ideaGenerationMs = Date.now() - ideaStart;

    if (!ideasResult.success) {
      this.log(pipelineRunId, 'IdeaGeneration failed', ideaGenerationMs);
      await this.persistRun({
        id: pipelineRunId,
        clientId: clientContext.id,
        status: 'failed',
        totalIdeas: 0,
        approvedCandidates: 0,
        considerCandidates: 0,
        rejectedCandidates: 0,
        ideaGenerationMs,
        iceScoringMs,
        persistenceMs,
        totalMs: Date.now() - pipelineStart,
        failedStage: 'IdeaGeneration',
        errorMessage: ideasResult.error,
        startedAt: new Date(pipelineStart),
        completedAt: new Date(),
      });
      return {
        success: false,
        pipelineRunId,
        failedStage: 'IdeaGeneration',
        error: ideasResult.error,
      };
    }

    this.log(pipelineRunId, 'IdeaGeneration completed', ideaGenerationMs);

    // Stamp every idea with this run's id. The IdeaAgent produces ideas without
    // knowing which pipeline run they belong to — that's the orchestrator's concern.
    const ideas: Idea[] = ideasResult.data.map((idea) => ({ ...idea, pipelineRunId }));

    // ── ICE Scoring ───────────────────────────────────────────────────────────

    const iceStart = Date.now();
    this.log(pipelineRunId, 'IceScoring started');

    const scoreResult = await this.iceScoringAgent.scoreIdeas(ideas, clientContext);
    iceScoringMs = Date.now() - iceStart;

    if (!scoreResult.success) {
      this.log(pipelineRunId, 'IceScoring failed', iceScoringMs);
      await this.persistRun({
        id: pipelineRunId,
        clientId: clientContext.id,
        status: 'failed',
        totalIdeas: ideas.length,
        approvedCandidates: 0,
        considerCandidates: 0,
        rejectedCandidates: 0,
        ideaGenerationMs,
        iceScoringMs,
        persistenceMs,
        totalMs: Date.now() - pipelineStart,
        failedStage: 'IceScoring',
        errorMessage: scoreResult.error,
        startedAt: new Date(pipelineStart),
        completedAt: new Date(),
      });
      return { success: false, pipelineRunId, failedStage: 'IceScoring', error: scoreResult.error };
    }

    this.log(pipelineRunId, 'IceScoring completed', iceScoringMs);

    const scoredIdeas = scoreResult.data;

    // ── Persistence ───────────────────────────────────────────────────────────

    const persistStart = Date.now();
    this.log(pipelineRunId, 'Persistence started');

    try {
      await saveIdeas(scoredIdeas);
    } catch (error) {
      persistenceMs = Date.now() - persistStart;
      this.log(pipelineRunId, 'Persistence failed', persistenceMs);
      const errMsg = error instanceof Error ? error.message : 'Unknown persistence error';
      await this.persistRun({
        id: pipelineRunId,
        clientId: clientContext.id,
        status: 'failed',
        totalIdeas: scoredIdeas.length,
        approvedCandidates: scoredIdeas.filter((i) => i.iceScore?.recommendation === 'APPROVE')
          .length,
        considerCandidates: scoredIdeas.filter((i) => i.iceScore?.recommendation === 'CONSIDER')
          .length,
        rejectedCandidates: scoredIdeas.filter((i) => i.iceScore?.recommendation === 'REJECT')
          .length,
        ideaGenerationMs,
        iceScoringMs,
        persistenceMs,
        totalMs: Date.now() - pipelineStart,
        failedStage: 'Persistence',
        errorMessage: errMsg,
        startedAt: new Date(pipelineStart),
        completedAt: new Date(),
      });
      return { success: false, pipelineRunId, failedStage: 'Persistence', error: errMsg };
    }

    persistenceMs = Date.now() - persistStart;
    this.log(pipelineRunId, 'Persistence completed', persistenceMs);

    const totalMs = Date.now() - pipelineStart;
    this.log(pipelineRunId, 'Pipeline completed', totalMs);

    // ── Summary ───────────────────────────────────────────────────────────────

    const summary: PipelineSummary = {
      totalIdeas: scoredIdeas.length,
      approvedCandidates: scoredIdeas.filter((i) => i.iceScore?.recommendation === 'APPROVE')
        .length,
      considerCandidates: scoredIdeas.filter((i) => i.iceScore?.recommendation === 'CONSIDER')
        .length,
      rejectedCandidates: scoredIdeas.filter((i) => i.iceScore?.recommendation === 'REJECT').length,
    };

    const timings: PipelineTimings = {
      memorySearchMs,
      ideaGenerationMs,
      iceScoringMs,
      persistenceMs,
      totalMs,
    };

    await this.persistRun({
      id: pipelineRunId,
      clientId: clientContext.id,
      status: 'completed',
      totalIdeas: summary.totalIdeas,
      approvedCandidates: summary.approvedCandidates,
      considerCandidates: summary.considerCandidates,
      rejectedCandidates: summary.rejectedCandidates,
      ideaGenerationMs,
      iceScoringMs,
      persistenceMs,
      totalMs,
      failedStage: null,
      errorMessage: null,
      startedAt: new Date(pipelineStart),
      completedAt: new Date(),
    });

    return {
      success: true,
      pipelineRunId,
      generatedAt: new Date(),
      clientId: clientContext.id,
      summary,
      timings,
      ideas: scoredIdeas,
    };
  }

}
