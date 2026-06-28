/**
 * Configuration for the ICE Scoring Agent.
 *
 * WHY temperature: 0.3
 *   Scoring is an analytical task — the same idea should score consistently
 *   across runs. High temperature (used for idea generation) introduces
 *   desirable creative randomness that would be harmful here. 0.3 keeps
 *   evaluations deterministic enough to be trustworthy while still allowing
 *   nuanced reasoning in the explanations.
 */

export interface IceAgentConfig {
  temperature: number;
}

export const iceAgentConfig: IceAgentConfig = {
  temperature: 0.3,
};
