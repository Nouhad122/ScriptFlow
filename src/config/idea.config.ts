/**
 * Configuration for the Idea Agent.
 *
 * ideaCount    — how many concepts to generate per run.
 * temperature  — passed to the ClaudeService for this agent.
 *                Higher = more creative variation. 1 is Claude's default max.
 * creativityLevel — controls the diversity instruction inside the prompt:
 *   'focused'      → proven angles only, best for cold traffic at scale
 *   'balanced'     → mix of proven and fresh angles (default)
 *   'experimental' → push creative boundaries, best for testing new hooks
 */

export type CreativityLevel = 'focused' | 'balanced' | 'experimental';

export interface IdeaAgentConfig {
  ideaCount: number;
  temperature: number;
  creativityLevel: CreativityLevel;
}

export const ideaAgentConfig: IdeaAgentConfig = {
  ideaCount: 8,
  temperature: 1,
  creativityLevel: 'balanced',
};
