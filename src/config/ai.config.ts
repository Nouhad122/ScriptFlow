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
 *   This config file drives the same parameters (model name, token limit,
 *   temperature) regardless of which provider is in use. The shape of AIConfig
 *   is stable across providers — agents and orchestrators never need to update.
 *
 * OPTIONAL HEADERS (siteUrl, appName):
 *   OpenRouter recommends including these to identify your application.
 *   They are sent as HTTP-Referer and X-Title headers respectively.
 *   Both are optional — the request succeeds without them.
 */

export interface AIConfig {
  model: string;
  maxTokens: number;
  temperature: number;
  siteUrl?: string;
  appName?: string;
}

export const aiConfig: AIConfig = {
  model: 'gemini-2.5-flash',
  maxTokens: 3000,
  temperature: 1,
  siteUrl: 'https://scriptflow.app',
  appName: 'ScriptFlow',
};
