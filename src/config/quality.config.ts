/**
 * Configuration for the Quality Review Agent.
 *
 * WHY temperature: 0.2
 *   Quality review is the strictest evaluative task in the pipeline.
 *   Reference points:
 *   - IdeaAgent: 1.0 — maximum creative divergence
 *   - ScriptAgent: 0.7 — structured creative prose
 *   - IceScoringAgent: 0.3 — analytical scoring
 *   - QualityReviewAgent: 0.2 — deterministic evaluation, consistent across runs
 *
 *   Fabrication detection in particular must be conservative. A fabricated claim
 *   that passes because the model was being "creative" in its interpretation is a
 *   production error that damages client trust. Lower temperature means the agent
 *   stays close to what's explicitly in the proof bank rather than rationalising
 *   approximate matches.
 */

export interface QualityAgentConfig {
  temperature: number;
}

export const qualityAgentConfig: QualityAgentConfig = {
  temperature: 0.2,
};
