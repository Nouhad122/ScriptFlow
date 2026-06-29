/**
 * Scripts controller — entry point for POST /api/scripts/generate.
 *
 * ERROR CODE CONTRACT:
 *   All errors carry an errorCode field so callers can branch on type, not message text.
 *
 *   IdeaNotFound       — no idea with the given ideaId exists in the database
 *   IdeaNotApproved    — the idea exists but is pending or rejected
 *   ScriptGenerationFailed — the ScriptAgent returned an error
 *   PersistenceFailed  — the script was generated but could not be saved
 *
 * WHY APPROVAL IS CHECKED HERE (not only in the agent):
 *   HTTP-layer validation (404 / 422) gives clients clear signals to act on:
 *   a 404 means "wrong ID", a 422 means "go approve the idea first."
 *   The agent also checks approval as a domain invariant — this is defence in
 *   depth, not redundancy. If the agent is later called from the orchestrator
 *   directly, the invariant still holds without relying on this controller.
 */

import type { Request, Response } from 'express';
import { AIService } from '../services/AIService';
import { ScriptAgent } from '../agents/ScriptAgent';
import { aiConfig } from '../config/ai.config';
import { scriptAgentConfig } from '../config/script.config';
import { env } from '../config/env';
import { getIdeaById } from '../database/ideas.repository';
import { saveScript, getScriptByIdeaId } from '../database/scripts.repository';
import type { ClientContext } from '../types';

export async function generateScript(req: Request, res: Response): Promise<void> {
  const { ideaId, clientContext } = req.body as {
    ideaId?: string;
    clientContext?: ClientContext;
  };

  if (!ideaId || typeof ideaId !== 'string') {
    res.status(400).json({ success: false, error: 'ideaId is required' });
    return;
  }

  if (!clientContext || !clientContext.id || !clientContext.name) {
    res.status(400).json({
      success: false,
      error: 'clientContext is required with at least id and name',
    });
    return;
  }

  // ── Fetch the idea ──────────────────────────────────────────────────────────

  const idea = await getIdeaById(ideaId);

  if (!idea) {
    res.status(404).json({
      success: false,
      errorCode: 'IdeaNotFound',
      error: `No idea found with id "${ideaId}"`,
    });
    return;
  }

  // ── Validate approval status ────────────────────────────────────────────────

  if (idea.approvalStatus !== 'approved') {
    res.status(422).json({
      success: false,
      errorCode: 'IdeaNotApproved',
      error:
        `Idea "${ideaId}" has status "${idea.approvalStatus}". ` +
        `Script generation is only allowed for approved ideas. ` +
        `Use PATCH /api/ideas/${ideaId}/approval to approve it first.`,
    });
    return;
  }

  // ── Check for existing script ───────────────────────────────────────────────

  const existing = await getScriptByIdeaId(ideaId);

  if (existing) {
    // Return the existing script — regeneration requires deleting the existing record.
    res.json({
      success: true,
      script: existing,
      durationMs: 0,
      note: 'A script for this idea already exists. The existing script was returned.',
    });
    return;
  }

  // ── Generate the script ─────────────────────────────────────────────────────

  const ai = new AIService(env.openrouterApiKey, {
    model: aiConfig.model,
    maxTokens: aiConfig.maxTokens,
    temperature: scriptAgentConfig.temperature,
  });

  const agent = new ScriptAgent(ai);

  // memoryContext is [] until the Memory Agent is implemented (Phase 5–6).
  const result = await agent.generateScript(idea, clientContext, []);

  if (!result.success) {
    res.status(500).json({
      success: false,
      errorCode: 'ScriptGenerationFailed',
      error: result.error,
      agentName: result.agentName,
      durationMs: result.durationMs,
    });
    return;
  }

  // ── Persist the script ──────────────────────────────────────────────────────

  try {
    await saveScript(result.data);
  } catch (error) {
    res.status(500).json({
      success: false,
      errorCode: 'PersistenceFailed',
      error: error instanceof Error ? error.message : 'Database error while saving script',
    });
    return;
  }

  res.json({
    success: true,
    script: result.data,
    durationMs: result.durationMs,
  });
}
