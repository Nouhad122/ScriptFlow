/**
 * Centralised Claude model configuration.
 *
 * The ClaudeService reads from this object — no model names or numeric limits
 * are hardcoded anywhere else. To change the model for the entire system,
 * change it here.
 *
 * Individual agents may override these values in the future by passing
 * a partial config to the ClaudeService constructor.
 */

export interface ClaudeConfig {
  model: string;
  maxTokens: number;
  temperature: number;
}

export const claudeConfig: ClaudeConfig = {
  model: 'claude-sonnet-4-6',
  maxTokens: 4096,
  temperature: 1,
};
