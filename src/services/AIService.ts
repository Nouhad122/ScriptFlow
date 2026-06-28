/**
 * AIService — the single communication channel between this application and the AI provider.
 *
 * WHY THIS ABSTRACTION EXISTS:
 *   Agents depend on AIService, not on any specific SDK (Gemini, OpenAI, Anthropic, etc.).
 *   This means the choice of AI provider is an infrastructure detail hidden behind this
 *   class. Swapping providers requires changing only this file — no agent, orchestrator,
 *   or route is aware of which vendor is being called.
 *
 *   This is the Dependency Inversion Principle: high-level modules (agents) depend on
 *   an abstraction (AIService), not on low-level details (Gemini SDK).
 *
 * HOW TO SWAP PROVIDERS:
 *   1. Install the new provider's SDK.
 *   2. Rewrite the private methods in this file to use the new SDK.
 *   3. Update ai.config.ts with the new model name.
 *   4. Update env.ts and .env.example with the new API key variable.
 *   Zero changes to agents, orchestrators, controllers, or prompts.
 *
 * RESPONSIBILITIES:
 *   - Initialize and manage the Gemini SDK client
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
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { GenerativeModel } from '@google/generative-ai';
import { type AIConfig, aiConfig } from '../config/ai.config';
import { env } from '../config/env';
import { AIProviderError, JsonParseError, MissingApiKeyError } from '../utils/errors';
import { logAiRequest } from '../utils/logger';

export class AIService {
  private readonly apiKey: string;
  private readonly config: AIConfig;

  // Lazily initialised — allows the server to start without a valid key
  // so the health endpoint can report a meaningful error instead of crashing on boot.
  private model: GenerativeModel | null = null;

  constructor(apiKey: string, config: AIConfig = aiConfig) {
    this.apiKey = apiKey;
    this.config = config;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Returns the Gemini GenerativeModel, validating the key and initialising
   * on first call. Throws MissingApiKeyError if the key is absent.
   *
   * The model is created once and cached. Temperature and maxOutputTokens are
   * baked into the model at construction time via generationConfig.
   */
  private ensureModel(): GenerativeModel {
    const trimmed = this.apiKey?.trim();
    if (!trimmed || trimmed === 'your_gemini_api_key_here') {
      throw new MissingApiKeyError();
    }
    if (!this.model) {
      const genAI = new GoogleGenerativeAI(trimmed);
      this.model = genAI.getGenerativeModel({
        model: this.config.model,
        generationConfig: {
          temperature: this.config.temperature,
          maxOutputTokens: this.config.maxTokens,
        },
      });
    }
    return this.model;
  }

  /**
   * Raw API call — no logging. Called by public methods that own their own
   * log entry. Keeping this private prevents double-logging on retry paths.
   */
  private async callAI(prompt: string): Promise<string> {
    const model = this.ensureModel();

    try {
      const result = await model.generateContent(prompt);
      const response = result.response;

      // Surface safety filter blocks as a typed error rather than letting
      // them produce an empty or undefined text() call downstream.
      const feedback = response.promptFeedback;
      if (feedback && feedback.blockReason) {
        throw new AIProviderError(
          `Request blocked by Gemini safety filters: ${String(feedback.blockReason)}`
        );
      }

      return response.text();
    } catch (error) {
      // Re-throw our own typed errors as-is
      if (error instanceof MissingApiKeyError || error instanceof AIProviderError) {
        throw error;
      }
      // Translate Gemini SDK errors into our typed error.
      // Gemini fetch errors carry a `status` HTTP code on the error object.
      const message = error instanceof Error ? error.message : 'Unknown error';
      const statusCode = (error as { status?: number }).status;
      throw new AIProviderError(message, statusCode);
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

    try {
      const result = await this.callAI(prompt);
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
 * The shared AIService instance used across the application.
 *
 * Agents receive this via constructor injection rather than importing it
 * directly — this keeps agents testable with mock service instances.
 *
 * The Gemini client is lazily initialised, so importing this module does not
 * throw even when GEMINI_API_KEY is missing. Errors surface on first method
 * call, which is where the health endpoint will catch them.
 */
export const aiService = new AIService(env.geminiApiKey);
