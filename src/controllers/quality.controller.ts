/**
 * Quality controller — entry point for POST /api/scripts/:scriptId/review.
 *
 * The controller fetches the script and its parent idea from the database.
 * The caller only needs to provide the clientContext — the script and idea
 * are resolved server-side from the scriptId in the URL.
 *
 * After a successful review, the controller:
 *   1. Saves the QualityReview to the quality_reviews table
 *   2. Updates the script status to 'passed' or 'held'
 *
 * WHY STATUS UPDATE IS IN THE CONTROLLER (not the agent):
 *   The agent evaluates and returns a domain object. The agent knows nothing about
 *   the database. Keeping the DB update in the controller preserves the dependency
 *   direction: agent → types only; controller → repositories.
 *
 * ERROR CODES:
 *   ScriptNotFound        — no script with the given scriptId exists
 *   IdeaNotFound          — the script's parent idea no longer exists (should not happen)
 *   ReviewGenerationFailed — the QualityReviewAgent returned an error
 *   PersistenceFailed     — review or status update failed to save
 */

import type { Request, Response } from 'express';
import { AIService } from '../services/AIService';
import { QualityReviewAgent } from '../agents/QualityReviewAgent';
import { aiConfig } from '../config/ai.config';
import { qualityAgentConfig } from '../config/quality.config';
import { env } from '../config/env';
import { getScriptById, updateScriptStatus } from '../database/scripts.repository';
import { getIdeaById } from '../database/ideas.repository';
import { saveReview, getReviewByScriptId } from '../database/quality.repository';
import type { ClientContext } from '../types';

export async function reviewScript(req: Request, res: Response): Promise<void> {
  const { scriptId } = req.params;
  const { clientContext } = req.body as { clientContext?: ClientContext };

  if (!clientContext || !clientContext.id || !clientContext.name) {
    res.status(400).json({
      success: false,
      error: 'clientContext is required with at least id and name',
    });
    return;
  }

  // ── Fetch the script ────────────────────────────────────────────────────────

  const script = await getScriptById(scriptId);

  if (!script) {
    res.status(404).json({
      success: false,
      errorCode: 'ScriptNotFound',
      error: `No script found with id "${scriptId}"`,
    });
    return;
  }

  // ── Fetch the parent idea ───────────────────────────────────────────────────

  const idea = await getIdeaById(script.ideaId);

  if (!idea) {
    res.status(404).json({
      success: false,
      errorCode: 'IdeaNotFound',
      error: `Parent idea "${script.ideaId}" not found — data integrity issue`,
    });
    return;
  }

  // ── Check for existing review ───────────────────────────────────────────────

  const existing = await getReviewByScriptId(scriptId);

  if (existing) {
    res.json({
      success: true,
      review: existing,
      script: { id: script.id, status: script.status },
      durationMs: 0,
      note: 'A review for this script already exists. The existing review was returned.',
    });
    return;
  }

  // ── Run the review ──────────────────────────────────────────────────────────

  const ai = new AIService(env.openrouterApiKey, {
    model: aiConfig.model,
    maxTokens: aiConfig.maxTokens,
    temperature: qualityAgentConfig.temperature,
  });

  const agent = new QualityReviewAgent(ai);
  const result = await agent.reviewScript(script, idea, clientContext);

  if (!result.success) {
    res.status(500).json({
      success: false,
      errorCode: 'ReviewGenerationFailed',
      error: result.error,
      agentName: result.agentName,
      durationMs: result.durationMs,
    });
    return;
  }

  // ── Persist review and update script status ─────────────────────────────────

  const newStatus = result.data.overallDecision === 'PASS' ? 'passed' : 'held';

  try {
    await saveReview(result.data);
    await updateScriptStatus(script.id, newStatus);
  } catch (error) {
    res.status(500).json({
      success: false,
      errorCode: 'PersistenceFailed',
      error: error instanceof Error ? error.message : 'Database error while saving review',
    });
    return;
  }

  res.json({
    success: true,
    review: result.data,
    script: { id: script.id, status: newStatus },
    durationMs: result.durationMs,
  });
}
