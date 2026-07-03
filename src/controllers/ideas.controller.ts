import type { Request, Response } from 'express';
import { AIService } from '../services/AIService';
import { IdeaAgent } from '../agents/IdeaAgent';
import { IceScoringAgent } from '../agents/IceScoringAgent';
import { aiConfig } from '../config/ai.config';
import { ideaAgentConfig } from '../config/idea.config';
import { iceAgentConfig } from '../config/ice.config';
import { env } from '../config/env';
import type { ClientContext, Idea } from '../types';
import {
  saveIdeas as dbSaveIdeas,
  getPendingIdeas as dbGetPendingIdeas,
  getApprovedIdeas as dbGetApprovedIdeas,
  updateIdeaApprovalStatus,
  getIdeaById,
} from '../database/ideas.repository';
import { getMemoryWriteService } from '../memory';

// ---------------------------------------------------------------------------
// POST /api/ideas/generate
// ---------------------------------------------------------------------------

/**
 * Returns the full Idea[] produced by IdeaAgent.
 *
 * WHY THE PREVIOUS IdeaApiResponse TRANSFORM WAS REMOVED:
 *   The pipeline flows generate → score → save. Both generate and score use
 *   the Idea type as their data contract. Renaming hookLine → concept and
 *   collapsing supportingProofPoints: string[] → supportingProof: string caused
 *   a crash in the ICE scoring prompt builder (`.join()` on undefined).
 */
export async function generateIdeas(req: Request, res: Response): Promise<void> {
  const { clientContext } = req.body as { clientContext?: ClientContext };

  if (!clientContext) {
    res.status(400).json({
      success: false,
      error: 'clientContext is required in the request body',
    });
    return;
  }

  if (!clientContext.id || !clientContext.name) {
    res.status(400).json({
      success: false,
      error: 'clientContext must include at least id and name',
    });
    return;
  }

  const ai = new AIService(env.openrouterApiKey, {
    model: aiConfig.model,
    maxTokens: aiConfig.maxTokens,
    temperature: ideaAgentConfig.temperature,
  });

  const agent = new IdeaAgent(ai);

  // No previous ideas at this stage — the Memory Agent will supply them later
  const result = await agent.generateIdeas(clientContext, []);

  if (!result.success) {
    res.status(500).json({
      success: false,
      error: result.error,
      agentName: result.agentName,
      durationMs: result.durationMs,
    });
    return;
  }

  res.json({
    success: true,
    count: result.data.length,
    durationMs: result.durationMs,
    ideas: result.data,
  });
}

// ---------------------------------------------------------------------------
// POST /api/ideas/score
// ---------------------------------------------------------------------------

/**
 * Accepts Idea[] and a ClientContext, returns the same ideas with iceScore populated.
 * Does NOT persist — scoring only. Call POST /api/ideas/save after this.
 */
export async function scoreIdeas(req: Request, res: Response): Promise<void> {
  const { ideas, clientContext } = req.body as {
    ideas?: Idea[];
    clientContext?: ClientContext;
  };

  if (!ideas || !Array.isArray(ideas) || ideas.length === 0) {
    res.status(400).json({
      success: false,
      error: 'ideas must be a non-empty array',
    });
    return;
  }

  if (!clientContext || !clientContext.id || !clientContext.name) {
    res.status(400).json({
      success: false,
      error: 'clientContext is required and must include at least id and name',
    });
    return;
  }

  const ai = new AIService(env.openrouterApiKey, {
    model: aiConfig.model,
    maxTokens: aiConfig.maxTokens,
    temperature: iceAgentConfig.temperature,
  });

  const agent = new IceScoringAgent(ai);
  const result = await agent.scoreIdeas(ideas, clientContext);

  if (!result.success) {
    res.status(500).json({
      success: false,
      error: result.error,
      agentName: result.agentName,
      durationMs: result.durationMs,
    });
    return;
  }

  res.json({
    success: true,
    count: result.data.length,
    durationMs: result.durationMs,
    ideas: result.data,
  });
}

// ---------------------------------------------------------------------------
// POST /api/ideas/save
// ---------------------------------------------------------------------------

/**
 * Persists a batch of scored ideas to SQLite.
 *
 * Expected input: the output of POST /api/ideas/score — Idea[] where each
 * idea has iceScore populated.
 *
 * Uses INSERT OR IGNORE so re-saving a batch never overwrites approval
 * status that was already set by a human.
 *
 * WHY THIS IS A SEPARATE ENDPOINT FROM /score:
 *   Scoring and saving are distinct steps. The human may want to inspect
 *   scores before committing them to the database. Keeping them separate
 *   also means the pipeline can be tested end-to-end without writing to disk.
 */
export async function saveIdeas(req: Request, res: Response): Promise<void> {
  const { ideas } = req.body as { ideas?: Idea[] };

  if (!ideas || !Array.isArray(ideas) || ideas.length === 0) {
    res.status(400).json({
      success: false,
      error: 'ideas must be a non-empty array',
    });
    return;
  }

  for (let i = 0; i < ideas.length; i++) {
    const idea = ideas[i];
    if (!idea.id || !idea.hookLine || !idea.clientId) {
      res.status(400).json({
        success: false,
        error: `Idea at index ${i} is missing required fields: id, hookLine, clientId`,
      });
      return;
    }
  }

  // JSON carries no Date objects — createdAt and approvedAt arrive as strings
  // (or are absent). Normalise before passing to the repository so ideaToArgs
  // can safely call .toISOString() and approvedBy is never undefined.
  const normalised: Idea[] = ideas.map((idea) => ({
    ...idea,
    createdAt: new Date(idea.createdAt),
    approvedAt: idea.approvedAt ? new Date(idea.approvedAt) : null,
    approvedBy: idea.approvedBy ?? null,
  }));

  try {
    await dbSaveIdeas(normalised);
    res.json({ success: true, saved: normalised.length });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Database error while saving ideas',
    });
  }
}

// ---------------------------------------------------------------------------
// GET /api/ideas/approved
// ---------------------------------------------------------------------------

export async function getApprovedIdeas(_req: Request, res: Response): Promise<void> {
  try {
    const ideas = await dbGetApprovedIdeas();
    res.json({ success: true, count: ideas.length, ideas });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Database error while fetching approved ideas',
    });
  }
}

// ---------------------------------------------------------------------------
// GET /api/ideas/pending
// ---------------------------------------------------------------------------

/**
 * Returns all ideas in the human approval queue (approvalStatus = 'pending').
 *
 * This is the endpoint the React dashboard will poll to populate the approval UI.
 * Results are ordered oldest-first so reviewers see them in generation order.
 */
export async function getPendingIdeas(_req: Request, res: Response): Promise<void> {
  try {
    const ideas = await dbGetPendingIdeas();
    res.json({ success: true, count: ideas.length, ideas });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Database error while fetching pending ideas',
    });
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/ideas/:id/approval
// ---------------------------------------------------------------------------

/**
 * Sets the approval status of an idea to 'approved' or 'rejected'.
 *
 * WHY THIS ONLY UPDATES THE DATABASE NOW:
 *   Script generation has not been implemented yet. When the Script Agent is
 *   added, approving an idea will automatically trigger script generation via
 *   the Pipeline Orchestrator. For now the approval is recorded and the updated
 *   idea is returned so the dashboard can reflect the change immediately.
 *
 * Returns 404 if no idea with the given id exists in the database.
 */
export async function approveIdea(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { status } = req.body as { status?: string };

  if (status !== 'approved' && status !== 'rejected') {
    res.status(400).json({
      success: false,
      error: 'status must be "approved" or "rejected"',
    });
    return;
  }

  try {
    const updated = await updateIdeaApprovalStatus(id, status);

    if (!updated) {
      res.status(404).json({
        success: false,
        error: `Idea with id "${id}" not found`,
      });
      return;
    }

    res.json({ success: true, idea: updated });

    if (status === 'approved') {
      void getMemoryWriteService()?.rememberApprovedIdea(updated);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Database error while updating approval status',
    });
  }
}
