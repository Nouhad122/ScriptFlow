/**
 * Central AI model configuration.
 *
 * AIService reads from this object — no model names, token limits, or
 * temperature values are hardcoded anywhere else in the application.
 * Changing the model for the entire system means changing it in one place.
 *
 * Individual agents may override temperature by passing a custom config
 * to the AIService constructor (see ideaAgentConfig for an example).
 *
 * WHY THIS IS SEPARATE FROM AIService:
 *   Configuration and behaviour are different concerns. Keeping them apart
 *   means you can change the model, tweak token limits, or adjust temperature
 *   without touching any service or agent logic.
 *
 * SWAPPING PROVIDERS:
 *   When a new AI provider is added, only AIService needs to change.
 *   This config file drives the same three parameters (model name, token limit,
 *   temperature) regardless of which provider is in use. The shape of AIConfig
 *   is stable across providers — agents and orchestrators never need to update.
 */

export interface AIConfig {
  model: string;
  maxTokens: number;
  temperature: number;
}

export const aiConfig: AIConfig = {
  model: 'gemini-2.0-flash-lite',
  maxTokens: 4096,
  temperature: 1,
};
