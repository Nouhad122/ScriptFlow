/**
 * AIService — the single communication channel between this application and the AI provider.
 *
 * WHY THIS ABSTRACTION EXISTS:
 *   Agents depend on AIService, not on any specific SDK or vendor.
 *   This means the choice of AI provider is an infrastructure detail hidden behind this
 *   class. Swapping providers requires changing only this file — no agent, orchestrator,
 *   or route is aware of which vendor is being called.
 *
 *   This is the Dependency Inversion Principle: high-level modules (agents) depend on
 *   an abstraction (AIService), not on low-level details (a specific SDK).
 *
 * CURRENT PROVIDER: OpenRouter
 *   OpenRouter exposes an OpenAI-compatible API, so the standard OpenAI SDK is used
 *   with a custom baseURL pointing to OpenRouter's endpoint.
 *   Model routing (which underlying LLM handles the request) is controlled by the
 *   model name in ai.config.ts — no code changes required to switch models.
 *
 * HOW TO SWAP PROVIDERS:
 *   1. Install the new provider's SDK (or keep the OpenAI SDK if compatible).
 *   2. Rewrite the private methods in this file to use the new SDK.
 *   3. Update ai.config.ts with the new model name.
 *   4. Update env.ts and .env.example with the new API key variable.
 *   Zero changes to agents, orchestrators, controllers, or prompts.
 *
 * RESPONSIBILITIES:
 *   - Initialize and manage the OpenAI SDK client pointed at OpenRouter
 *   - Validate the API key before any request is made
 *   - Send prompts and return responses
 *   - Handle and translate SDK errors into typed application errors
 *   - Log every AI request (provider, method, model, duration, outcome, HTTP status)
 *   - Parse and validate JSON responses for structured generation
 *
 * NOT RESPONSIBLE FOR:
 *   - Prompt engineering (agents own their prompts)
 *   - Business logic (orchestrator owns sequencing)
 *   - Data persistence (memory agent owns storage)
 */

import OpenAI, { APIError } from 'openai';
import { type AIConfig, aiConfig } from '../config/ai.config';
import { env } from '../config/env';
import { AIProviderError, JsonParseError, MissingApiKeyError } from '../utils/errors';
import { logAiRequest } from '../utils/logger';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const PROVIDER_NAME = 'openrouter';

export class AIService {
  private readonly apiKey: string;
  private readonly config: AIConfig;

  // Lazily initialised — allows the server to start without a valid key
  // so the health endpoint can report a meaningful error instead of crashing on boot.
  private client: OpenAI | null = null;

  constructor(apiKey: string, config: AIConfig = aiConfig) {
    this.apiKey = apiKey;
    this.config = config;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Returns the OpenAI client configured for OpenRouter, validating the key
   * and initialising on first call. Throws MissingApiKeyError if the key is absent.
   *
   * Optional HTTP-Referer and X-Title headers are added when siteUrl/appName
   * are present in config — OpenRouter uses these to attribute traffic.
   */
  private ensureClient(): OpenAI {
    const trimmed = this.apiKey?.trim();
    if (!trimmed || trimmed === 'your_openrouter_api_key_here') {
      throw new MissingApiKeyError();
    }
    if (!this.client) {
      const defaultHeaders: Record<string, string> = {};
      if (this.config.siteUrl) defaultHeaders['HTTP-Referer'] = this.config.siteUrl;
      if (this.config.appName) defaultHeaders['X-Title'] = this.config.appName;

      this.client = new OpenAI({
        baseURL: OPENROUTER_BASE_URL,
        apiKey: trimmed,
        defaultHeaders,
      });
    }
    return this.client;
  }

  /**
   * Raw API call — no logging. Called by public methods that own their own
   * log entry. Keeping this private prevents double-logging on retry paths.
   */
  private async callAI(prompt: string): Promise<string> {
    const client = this.ensureClient();

    try {
      const response = await client.chat.completions.create({
        model: this.config.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
      });

      const text = response.choices[0]?.message?.content;
      if (!text) {
        throw new AIProviderError('OpenRouter returned an empty response');
      }
      return text;
    } catch (error) {
      // Re-throw our own typed errors as-is
      if (error instanceof MissingApiKeyError || error instanceof AIProviderError) {
        throw error;
      }
      // Translate OpenAI SDK errors (which OpenRouter also surfaces) into our typed error.
      // APIError carries the HTTP status code from the upstream response.
      if (error instanceof APIError) {
        throw new AIProviderError(error.message, error.status);
      }
      throw new AIProviderError(
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Strips markdown code fences that the model sometimes adds despite instructions,
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
   * Sends a plain-text prompt to the AI provider and returns the response string.
   *
   * Agents use this for prompts that do not require structured output.
   */
  async generateText(prompt: string): Promise<string> {
    const start = Date.now();
    let success = false;
    let errorName: string | undefined;
    let statusCode: number | undefined;

    try {
      const result = await this.callAI(prompt);
      success = true;
      return result;
    } catch (error) {
      errorName = error instanceof Error ? error.name : 'UnknownError';
      statusCode = error instanceof AIProviderError ? error.statusCode : undefined;
      throw error;
    } finally {
      logAiRequest({
        provider: PROVIDER_NAME,
        method: 'generateText',
        model: this.config.model,
        durationMs: Date.now() - start,
        success,
        error: errorName,
        statusCode,
      });
    }
  }

  /**
   * Sends a prompt to the AI provider and parses the response as a typed JSON value.
   *
   * Agents use this whenever they need a structured object back (ideas, scores,
   * quality reviews, scripts). The generic parameter T is the expected shape.
   *
   * Retry strategy:
   *   1. Ask the model for JSON using the wrapped prompt
   *   2. If JSON.parse fails, send a one-shot correction prompt
   *   3. If parsing still fails, throw JsonParseError — do not silently proceed
   *
   * The total duration logged includes any retry call.
   */
  async generateStructured<T>(prompt: string): Promise<T> {
    const start = Date.now();
    let success = false;
    let errorName: string | undefined;
    let statusCode: number | undefined;

    try {
      const raw = await this.callAI(this.buildJsonPrompt(prompt));

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

        const corrected = await this.callAI(correctionPrompt);

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
      statusCode = error instanceof AIProviderError ? error.statusCode : undefined;
      throw error;
    } finally {
      logAiRequest({
        provider: PROVIDER_NAME,
        method: 'generateStructured',
        model: this.config.model,
        durationMs: Date.now() - start,
        success,
        error: errorName,
        statusCode,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

/**
 * The shared AIService instance used across the application.
 *
 * Agents receive this via constructor injection rather than importing it
 * directly — this keeps agents testable with mock service instances.
 *
 * The client is lazily initialised, so importing this module does not
 * throw even when OPENROUTER_API_KEY is missing. Errors surface on first
 * method call, which is where the health endpoint will catch them.
 */
export const aiService = new AIService(env.openrouterApiKey);
