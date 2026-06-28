/**
 * ClaudeService — the single communication channel between this application and the Anthropic API.
 *
 * RESPONSIBILITIES:
 *   - Initialize and manage the Anthropic SDK client
 *   - Validate the API key before any request is made
 *   - Send prompts and return responses
 *   - Handle and translate SDK errors into typed application errors
 *   - Log every AI request (method, model, duration, outcome)
 *   - Parse and validate JSON responses for structured generation
 *
 * NOT RESPONSIBLE FOR:
 *   - Prompt engineering (agents own their prompts)
 *   - Business logic (orchestrator owns sequencing)
 *   - Data persistence (memory agent owns storage)
 *
 * HOW AGENTS WILL USE THIS SERVICE:
 *   Each agent receives a ClaudeService instance via constructor injection.
 *   The agent builds its prompt, calls claudeService.generateText() or
 *   claudeService.generateStructured<T>(), and works with the typed result.
 *   The agent never touches the Anthropic SDK directly.
 *
 * WHY THE SERVICE IS SEPARATE FROM AGENTS:
 *   A change to the Claude API (new model, changed error codes, rate limits)
 *   requires modifying only this file. All 6 agents remain untouched.
 *   This is the Open/Closed Principle in practice.
 */

import Anthropic, { APIError } from '@anthropic-ai/sdk';
import { type ClaudeConfig, claudeConfig } from '../config/claude.config';
import { ClaudeApiError, JsonParseError, MissingApiKeyError } from '../utils/errors';
import { logAiRequest } from '../utils/logger';

export class ClaudeService {
  private readonly apiKey: string;
  private readonly config: ClaudeConfig;

  // Lazily initialised — allows the server to start without a valid key
  // so the health endpoint can report a meaningful error instead of crashing on boot.
  private client: Anthropic | null = null;

  constructor(apiKey: string, config: ClaudeConfig = claudeConfig) {
    this.apiKey = apiKey;
    this.config = config;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Returns the Anthropic client, validating the key and initialising the
   * client on first call. Throws MissingApiKeyError if the key is absent.
   */
  private ensureClient(): Anthropic {
    const trimmed = this.apiKey?.trim();
    if (!trimmed || trimmed === 'your_anthropic_api_key_here') {
      throw new MissingApiKeyError();
    }
    if (!this.client) {
      this.client = new Anthropic({ apiKey: trimmed });
    }
    return this.client;
  }

  /**
   * Raw API call — no logging. Called by public methods that own their own
   * log entry. Keeping this private prevents double-logging on retry paths.
   */
  private async callClaude(prompt: string): Promise<string> {
    const client = this.ensureClient();

    try {
      const message = await client.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        messages: [{ role: 'user', content: prompt }],
      });

      const block = message.content[0];
      if (block.type !== 'text') {
        throw new ClaudeApiError(`Unexpected response content type: ${block.type}`);
      }

      return block.text;
    } catch (error) {
      // Re-throw our own errors as-is
      if (error instanceof MissingApiKeyError || error instanceof ClaudeApiError) {
        throw error;
      }
      // Translate Anthropic SDK errors into our typed error
      if (error instanceof APIError) {
        throw new ClaudeApiError(error.message, error.status);
      }
      throw new ClaudeApiError(
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Strips markdown code fences that Claude sometimes adds despite instructions,
   * then parses the cleaned string as JSON.
   * Throws a native SyntaxError (from JSON.parse) if the string is invalid JSON.
   */
  private parseJSON<T>(raw: string): T {
    const codeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const cleaned = codeBlockMatch ? codeBlockMatch[1].trim() : raw.trim();
    return JSON.parse(cleaned) as T;
  }

  /**
   * Wraps any prompt with an unambiguous JSON-only instruction.
   * Placed at the end so it overrides any contradictory instructions above it.
   */
  private buildJsonPrompt(prompt: string): string {
    return (
      `${prompt}\n\n` +
      `---\n` +
      `CRITICAL RESPONSE REQUIREMENT:\n` +
      `You MUST respond with ONLY a valid JSON object or array.\n` +
      `Do NOT include markdown code blocks, backticks, or any explanation.\n` +
      `Do NOT include any text before or after the JSON.\n` +
      `Begin your response with { or [ and end with } or ].`
    );
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Sends a plain-text prompt to Claude and returns the response string.
   *
   * Agents use this for prompts that do not require structured output.
   */
  async generateText(prompt: string): Promise<string> {
    const start = Date.now();
    let success = false;
    let errorName: string | undefined;

    try {
      const result = await this.callClaude(prompt);
      success = true;
      return result;
    } catch (error) {
      errorName = error instanceof Error ? error.name : 'UnknownError';
      throw error;
    } finally {
      logAiRequest({
        method: 'generateText',
        model: this.config.model,
        durationMs: Date.now() - start,
        success,
        error: errorName,
      });
    }
  }

  /**
   * Sends a prompt to Claude and parses the response as a typed JSON value.
   *
   * Agents use this whenever they need a structured object back (ideas, scores,
   * quality reviews, scripts). The generic parameter T is the expected shape.
   *
   * Retry strategy:
   *   1. Ask Claude for JSON using the wrapped prompt
   *   2. If JSON.parse fails, send a one-shot correction prompt
   *   3. If parsing still fails, throw JsonParseError — do not silently proceed
   *
   * The total duration logged includes any retry call.
   */
  async generateStructured<T>(prompt: string): Promise<T> {
    const start = Date.now();
    let success = false;
    let errorName: string | undefined;

    try {
      const raw = await this.callClaude(this.buildJsonPrompt(prompt));

      try {
        const parsed = this.parseJSON<T>(raw);
        success = true;
        return parsed;
      } catch {
        // First attempt failed — retry once with an explicit correction prompt
        const correctionPrompt =
          `The text below failed JSON parsing. ` +
          `Return ONLY the valid JSON object or array from it, ` +
          `with no other text, no code fences, no explanation:\n\n${raw}`;

        const corrected = await this.callClaude(correctionPrompt);

        try {
          const parsed = this.parseJSON<T>(corrected);
          success = true;
          return parsed;
        } catch {
          throw new JsonParseError(raw);
        }
      }
    } catch (error) {
      errorName = error instanceof Error ? error.name : 'UnknownError';
      throw error;
    } finally {
      logAiRequest({
        method: 'generateStructured',
        model: this.config.model,
        durationMs: Date.now() - start,
        success,
        error: errorName,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

/**
 * The shared ClaudeService instance used across the application.
 *
 * Agents receive this via constructor injection rather than importing it
 * directly — this keeps agents testable with mock service instances.
 *
 * The client is lazily initialised, so importing this module does not
 * throw even when ANTHROPIC_API_KEY is missing. Errors surface on first
 * method call, which is where the health endpoint will catch them.
 */
import { env } from '../config/env';
export const claudeService = new ClaudeService(env.anthropicApiKey);
