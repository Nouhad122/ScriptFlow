/**
 * PipelineOrchestrator coordinates the six AI agents in the correct sequence.
 *
 * IMPORTANT DESIGN RULE:
 * The Orchestrator NEVER calls the AI provider directly.
 * It NEVER generates AI content.
 * Its only job is sequencing, error checking, and passing data between agents.
 *
 * All six agents are injected via the constructor. The Orchestrator knows only
 * the agent interfaces — not the concrete implementations. This allows agents
 * to be swapped or mocked without modifying this file.
 *
 * Pipeline flow:
 *
 * Stage 1 — Idea Generation (triggered manually from dashboard):
 *   MemoryAgent.getPreviousIdeas()
 *     → IdeaAgent.generateIdeas()
 *     → IceScoringAgent.scoreIdeas()
 *     → MemoryAgent.storeIdeas()
 *     → [ideas saved, dashboard shows them for human approval]
 *
 * Stage 2 — Script Generation (triggered automatically on idea approval):
 *   MemoryAgent.getPreviousIdeas() [for context]
 *   MemoryAgent.getApprovedScripts() [for learning context]
 *     → ScriptAgent.generateScript()
 *     → QualityReviewAgent.reviewScript()
 *     → if passed: DeliveryAgent.deliverScript() → MemoryAgent.storeApprovedScript()
 *     → if held:   script is flagged, not delivered
 */

import type {
  AgentResult,
  ClientContext,
  Idea,
  Script,
} from '../types';
import type {
  IDeliveryAgent,
  IIceScoringAgent,
  IIdeaAgent,
  IMemoryAgent,
  IQualityReviewAgent,
  IScriptAgent,
} from '../agents/interfaces';

export class PipelineOrchestrator {
  private readonly ideaAgent: IIdeaAgent;
  private readonly iceScoringAgent: IIceScoringAgent;
  private readonly memoryAgent: IMemoryAgent;
  private readonly scriptAgent: IScriptAgent;
  private readonly qualityReviewAgent: IQualityReviewAgent;
  private readonly deliveryAgent: IDeliveryAgent;

  constructor(
    ideaAgent: IIdeaAgent,
    iceScoringAgent: IIceScoringAgent,
    memoryAgent: IMemoryAgent,
    scriptAgent: IScriptAgent,
    qualityReviewAgent: IQualityReviewAgent,
    deliveryAgent: IDeliveryAgent
  ) {
    this.ideaAgent = ideaAgent;
    this.iceScoringAgent = iceScoringAgent;
    this.memoryAgent = memoryAgent;
    this.scriptAgent = scriptAgent;
    this.qualityReviewAgent = qualityReviewAgent;
    this.deliveryAgent = deliveryAgent;
  }

  /**
   * Stage 1: Generate and ICE-score a batch of ideas for a client.
   *
   * Flow:
   *   1. Fetch all previous ideas from memory (duplicate prevention context)
   *   2. Idea Agent generates new ideas using ClientContext + previous ideas
   *   3. ICE Scoring Agent scores each idea individually
   *   4. Memory Agent stores the scored ideas
   *   5. Return scored ideas to the caller (dashboard will display them for approval)
   *
   * The human approval step happens OUTSIDE this method — in the dashboard.
   * When the human marks an idea Approved, processApprovedIdea() is called.
   */
  async generateAndScoreIdeas(clientContext: ClientContext): Promise<AgentResult<Idea[]>> {
    throw new Error(
      'Not implemented yet — will be implemented when agents are built (Phase 3–4)'
    );
  }

  /**
   * Stage 2: Generate, review, and deliver a script for one approved idea.
   *
   * Flow:
   *   1. Fetch the approved idea by ID from memory
   *   2. Fetch previously approved scripts (learning context for the Script Agent)
   *   3. Fetch ClientContext for the idea's client
   *   4. Script Agent generates a complete script (Hook 1/2/3 + Pain>Promise>Proof>CTA)
   *   5. Quality Review Agent evaluates all 10 checklist items
   *   6a. PASSED: Delivery Agent writes the Markdown file → Memory Agent stores script
   *   6b. HELD:   Script is flagged with heldReason, not delivered
   *   7. Return the final Script to the caller
   *
   * This method is triggered automatically when a human approves an idea —
   * no further manual steps are required.
   */
  async processApprovedIdea(ideaId: string): Promise<AgentResult<Script>> {
    throw new Error(
      'Not implemented yet — will be implemented when agents are built (Phase 7–10)'
    );
  }
}
