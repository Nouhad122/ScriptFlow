/**
 * AIService — the single communication channel between this application and the AI provider.
 *
 * CURRENT PROVIDER: Google Gemini (native SDK)
 *   Uses @google/generative-ai for direct access to Gemini models.
 *   generateStructured uses responseMimeType: 'application/json' which forces the model
 *   to output valid JSON — schema-level enforcement, not just a prompt instruction.
 *
 * HOW TO SWAP PROVIDERS:
 *   1. Install the new provider's SDK.
 *   2. Rewrite the private methods in this file.
 *   3. Update ai.config.ts with the new model name.
 *   4. Update env.ts and .env.example with the new API key variable.
 *   Zero changes to agents, orchestrators, controllers, or prompts.
 */

import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai';
import { type AIConfig, aiConfig } from '../config/ai.config';
import { env } from '../config/env';
import { AIProviderError, JsonParseError, MissingApiKeyError } from '../utils/errors';
import { logAiRequest } from '../utils/logger';

const PROVIDER_NAME = 'gemini';

export class AIService {
  private readonly apiKey: string;
  private readonly config: AIConfig;

  private genAI: GoogleGenerativeAI | null = null;

  constructor(apiKey: string, config: AIConfig = aiConfig) {
    this.apiKey = apiKey;
    this.config = config;
  }

  private ensureClient(): GoogleGenerativeAI {
    const trimmed = this.apiKey?.trim();
    if (!trimmed) throw new MissingApiKeyError();
    if (!this.genAI) this.genAI = new GoogleGenerativeAI(trimmed);
    return this.genAI;
  }

  private getModel(isJson: boolean): GenerativeModel {
    const client = this.ensureClient();
    return client.getGenerativeModel({
      model: this.config.model,
      generationConfig: {
        maxOutputTokens: this.config.maxTokens,
        temperature: this.config.temperature,
        ...(isJson && { responseMimeType: 'application/json' }),
      },
    });
  }

  private async callAI(prompt: string, isJson = false, attempt = 1): Promise<string> {
    const MAX_ATTEMPTS = 3;
    const model = this.getModel(isJson);

    try {
      const result = await model.generateContent(prompt);
      const response = result.response;

      if (response.promptFeedback?.blockReason) {
        throw new AIProviderError(
          `Content blocked by Gemini safety filters: ${response.promptFeedback.blockReason}`
        );
      }

      const text = response.text();
      if (!text) throw new AIProviderError('Gemini returned an empty response');
      return text;
    } catch (error) {
      if (error instanceof MissingApiKeyError || error instanceof AIProviderError) throw error;

      const message = error instanceof Error ? error.message : 'Unknown error';
      const statusMatch = message.match(/\[(\d{3})\s/);
      const statusCode = statusMatch ? parseInt(statusMatch[1], 10) : undefined;

      // Retry on transient errors: 503 (service unavailable) and 429 (rate limit).
      // Exponential backoff: 2s → 4s before attempts 2 and 3.
      if ((statusCode === 503 || statusCode === 429) && attempt < MAX_ATTEMPTS) {
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
        return this.callAI(prompt, isJson, attempt + 1);
      }

      throw new AIProviderError(message, statusCode);
    }
  }

  private parseJSON<T>(raw: string): T {
    const codeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const cleaned = codeBlockMatch ? codeBlockMatch[1].trim() : raw.trim();
    return JSON.parse(cleaned) as T;
  }

  async generateText(prompt: string): Promise<string> {
    const start = Date.now();
    let success = false;
    let errorName: string | undefined;
    let statusCode: number | undefined;

    try {
      const result = await this.callAI(prompt, false);
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

  async generateStructured<T>(prompt: string): Promise<T> {
    const start = Date.now();
    let success = false;
    let errorName: string | undefined;
    let statusCode: number | undefined;

    try {
      const raw = await this.callAI(prompt, true);

      try {
        const parsed = this.parseJSON<T>(raw);
        success = true;
        return parsed;
      } catch {
        const correctionPrompt =
          `The text below failed JSON parsing. ` +
          `Return ONLY the valid JSON object or array from it, ` +
          `with no other text, no code fences, no explanation:\n\n${raw}`;

        const corrected = await this.callAI(correctionPrompt, true);

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

export const aiService = new AIService(env.geminiApiKey);
