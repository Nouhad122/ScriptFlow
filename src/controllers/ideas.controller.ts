import type { Request, Response } from 'express';
import { AIService } from '../services/AIService';
import { IdeaAgent } from '../agents/IdeaAgent';
import { aiConfig } from '../config/ai.config';
import { ideaAgentConfig } from '../config/idea.config';
import { env } from '../config/env';
import type { ClientContext } from '../types';

/**
 * Maps the internal Idea type (which uses hookLine) to the API response shape
 * (which uses concept, per the assessment brief specification).
 *
 * This is the only place where hookLine ↔ concept translation happens.
 * All internal code uses hookLine; the public API surface uses concept.
 */
interface IdeaApiResponse {
  id: string;
  concept: string;
  creativeType: string;
  angle: string;
  leadType: string;
  supportingProof: string;
  targetAvatar: string;
  targetPain: string;
}

/**
 * POST /api/ideas/generate
 *
 * Accepts a clientContext in the request body.
 * Runs the IdeaAgent and returns the generated ideas.
 * Does NOT persist anything — generation only.
 *
 * Note: AIService is instantiated here with the temperature from ideaAgentConfig.
 * When the full composition root is built (src/index.ts), this construction will
 * move there and agents will be injected.
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

  const ai = new AIService(env.geminiApiKey, {
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

  const response: IdeaApiResponse[] = result.data.map((idea) => ({
    id: idea.id,
    concept: idea.hookLine,
    creativeType: idea.creativeType,
    angle: idea.angle,
    leadType: idea.leadType,
    supportingProof: idea.supportingProofPoints[0] ?? '',
    targetAvatar: idea.targetAvatar,
    targetPain: idea.targetPain,
  }));

  res.json({
    success: true,
    count: response.length,
    durationMs: result.durationMs,
    ideas: response,
  });
}
