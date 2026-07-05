/**
 * Agent interfaces define the behavioral contracts for each AI agent.
 *
 * The Orchestrator depends only on these interfaces — never on concrete implementations.
 * This means any agent can be swapped, mocked for testing, or replaced with a
 * different AI provider without touching the Orchestrator.
 *
 * Each interface has exactly one responsibility, matching the single-responsibility
 * principle defined in the project plan.
 */

import type { AgentResult, ClientContext, Idea, QualityReview, Script } from '../types';
import type { MemoryMatch } from '../memory';

/**
 * Generates a batch of raw script concepts (ideas) for a client.
 * Draws all facts and proof from the ClientContext and Reference Pack.
 * Receives previousIdeas for same-session deduplication and memoryMatches
 * (from MemorySearchService) so historically approved content shapes diversity.
 */
export interface IIdeaAgent {
  generateIdeas(
    context: ClientContext,
    previousIdeas: Idea[],
    memoryMatches?: MemoryMatch[]
  ): Promise<AgentResult<Idea[]>>;
}

/**
 * Evaluates each idea on Impact, Confidence, and Ease.
 * Attaches an IceScore to every Idea it receives.
 * No human scores ideas — this agent is the only scorer.
 */
export interface IIceScoringAgent {
  scoreIdeas(ideas: Idea[], context: ClientContext): Promise<AgentResult<Idea[]>>;
}

/**
 * Owns all persistence for the self-iterating memory layer:
 *   - Stores and retrieves previous ideas (used for duplicate prevention)
 *   - Stores and retrieves approved scripts (used as learning context for the Script Agent)
 *   - Checks whether a new idea is semantically similar to a previous one
 */
export interface IMemoryAgent {
  getPreviousIdeas(clientId: string): Promise<Idea[]>;
  storeIdeas(ideas: Idea[]): Promise<void>;
  getApprovedScripts(clientId: string): Promise<Script[]>;
  storeApprovedScript(script: Script): Promise<void>;
  isDuplicate(hookLine: string, clientId: string): Promise<boolean>;
}

/**
 * Generates a complete, production-ready script from an approved idea.
 * Receives the full Idea record, ClientContext, and previously approved scripts
 * as memory context so each generation round can improve on the last.
 */
export interface IScriptAgent {
  generateScript(
    idea: Idea,
    context: ClientContext,
    memoryContext: Script[]
  ): Promise<AgentResult<Script>>;
}

/**
 * Evaluates a generated script against all 10 quality checklist items individually.
 * Returns a structured QualityReview — never a single pass/fail boolean.
 * A script that fails any single item is held and not delivered.
 *
 * WHY idea IS INCLUDED:
 *   The original Idea carries the approved hookLine, targetPain, angle, and
 *   supportingProofPoints. Without it, the agent cannot check whether the script
 *   stayed true to the approved concept or whether the proof references match
 *   what the human approved. The Idea is the ground truth against which the
 *   script is measured.
 */
export interface IQualityReviewAgent {
  reviewScript(
    script: Script,
    idea: Idea,
    context: ClientContext
  ): Promise<AgentResult<QualityReview>>;
}

/**
 * Formats a passing script as a clean Markdown document and writes it to the output folder.
 * Returns the file path of the delivered document.
 * Zero manual steps between quality approval and delivery.
 */
export interface IDeliveryAgent {
  deliverScript(script: Script, context: ClientContext): Promise<AgentResult<string>>;
}
