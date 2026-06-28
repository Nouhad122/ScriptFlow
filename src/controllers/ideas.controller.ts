import type { Request, Response } from 'express';
import { AIService } from '../services/AIService';
import { IdeaAgent } from '../agents/IdeaAgent';
import { IceScoringAgent } from '../agents/IceScoringAgent';
import { aiConfig } from '../config/ai.config';
import { ideaAgentConfig } from '../config/idea.config';
import { iceAgentConfig } from '../config/ice.config';
import { env } from '../config/env';
import type { ClientContext, Idea } from '../types';

// ---------------------------------------------------------------------------
// POST /api/ideas/generate
// ---------------------------------------------------------------------------

/**
 * Returns the full Idea[] produced by IdeaAgent.
 *
 * WHY THE PREVIOUS IdeaApiResponse TRANSFORM WAS REMOVED:
 *   The pipeline flows generate → score. The generate endpoint previously mapped
 *   the internal Idea type to a leaner shape:
 *     hookLine           → concept
 *     supportingProofPoints: string[] → supportingProof: string  (first element only)
 *   When callers passed that output to POST /api/ideas/score, the ice prompt builder
 *   called idea.supportingProofPoints.join(…) on a field that no longer existed
 *   on the object, crashing with "Cannot read properties of undefined (reading 'join')".
 *   TypeScript did not catch this because the controller used an "as" cast.
 *
 *   Both endpoints share the Idea type as their data contract. No transformation
 *   happens at the API boundary because there is no separate consumer of the
 *   generate endpoint that requires a different shape.
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
 * Accepts an array of Ideas and a ClientContext.
 * Runs the IceScoringAgent and returns the same ideas with iceScore populated.
 * Does NOT persist anything — scoring only.
 *
 * WHY clientContext IS REQUIRED:
 *   The scoring prompt evaluates "target audience fit", "business value", and
 *   "alignment with client context". Without the full context (avatars, proof bank,
 *   offer mechanics, brand voice), these dimensions cannot be evaluated meaningfully.
 *
 * HOW THIS ENDPOINT IS USED IN THE PIPELINE:
 *   1. POST /api/ideas/generate → returns Idea[] (iceScore: null on each)
 *   2. POST /api/ideas/score   → accepts the same Idea[], returns them with iceScore populated
 *   3. Dashboard displays scored ideas for human approval
 *   Once the Memory Agent is implemented, steps 1–2 will run automatically
 *   via the Pipeline Orchestrator.
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
