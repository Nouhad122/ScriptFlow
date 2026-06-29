/**
 * Pipeline controller — entry point for POST /api/pipeline/run.
 *
 * WHY THE CONTROLLER CREATES THE AGENTS:
 *   The PipelineOrchestrator depends on agent interfaces, not concrete classes.
 *   Concrete classes (IdeaAgent, IceScoringAgent) require AIService, which
 *   requires an API key and a temperature setting. The controller is the
 *   composition root for this request: it wires up the correct AIService
 *   configuration per agent, then hands them to the orchestrator.
 *
 *   When a dependency injection container is added later, this wiring moves
 *   there. For now it lives in the controller, which is the correct place at
 *   this stage of the project.
 */

import type { Request, Response } from 'express';
import { AIService } from '../services/AIService';
import { IdeaAgent } from '../agents/IdeaAgent';
import { IceScoringAgent } from '../agents/IceScoringAgent';
import { PipelineOrchestrator } from '../orchestrator/PipelineOrchestrator';
import { aiConfig } from '../config/ai.config';
import { ideaAgentConfig } from '../config/idea.config';
import { iceAgentConfig } from '../config/ice.config';
import { env } from '../config/env';
import type { ClientContext } from '../types';

export async function runPipeline(req: Request, res: Response): Promise<void> {
  const { clientContext } = req.body as { clientContext?: ClientContext };

  if (!clientContext || !clientContext.id || !clientContext.name) {
    res.status(400).json({
      success: false,
      error: 'clientContext is required with at least id and name',
    });
    return;
  }

  // Each agent gets its own AIService instance with the temperature appropriate
  // for its cognitive task: 1.0 for creative generation, 0.3 for analytical scoring.
  const ideaAI = new AIService(env.openrouterApiKey, {
    model: aiConfig.model,
    maxTokens: aiConfig.maxTokens,
    temperature: ideaAgentConfig.temperature,
  });

  const iceAI = new AIService(env.openrouterApiKey, {
    model: aiConfig.model,
    maxTokens: aiConfig.maxTokens,
    temperature: iceAgentConfig.temperature,
  });

  const orchestrator = new PipelineOrchestrator(
    new IdeaAgent(ideaAI),
    new IceScoringAgent(iceAI)
  );

  try {
    const result = await orchestrator.generateAndScoreIdeas(clientContext);
    const status = result.success ? 200 : 500;
    res.status(status).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unexpected pipeline error',
    });
  }
}
