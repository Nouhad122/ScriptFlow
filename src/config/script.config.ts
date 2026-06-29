/**
 * Configuration for the Script Agent.
 *
 * WHY temperature: 0.7
 *   Script generation requires a balance the other two agents do not:
 *   - Creative, engaging prose (too low = robotic, templated writing)
 *   - Reliable structured JSON output (too high = creative content with bad structure)
 *
 *   Reference points:
 *   - IdeaAgent uses 1.0 — maximum creative divergence, structure is loose
 *   - IceScoringAgent uses 0.3 — analytical precision, same idea scores consistently
 *   - ScriptAgent at 0.7 — produce compelling narrative, stay inside the schema
 *
 *   0.7 is the established midpoint for "generate creative content inside a rigid
 *   output structure." High enough to write naturally conversational prose, low
 *   enough to reliably return all 6 sections in valid JSON format.
 */

export interface ScriptAgentConfig {
  temperature: number;
}

export const scriptAgentConfig: ScriptAgentConfig = {
  temperature: 0.7,
};
