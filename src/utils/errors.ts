/**
 * Custom error classes for the AI infrastructure layer.
 *
 * Using named classes instead of generic Error objects allows callers to use
 * instanceof checks for precise error handling without string matching.
 *
 * These error classes are provider-agnostic — they describe the failure
 * category (missing key, provider error, parse failure) without referencing
 * any specific AI vendor. Swapping the provider does not change these types.
 *
 * Example:
 *   catch (error) {
 *     if (error instanceof MissingApiKeyError) { ... }
 *     if (error instanceof AIProviderError) { ... }
 *   }
 */

export class MissingApiKeyError extends Error {
  constructor() {
    super(
      'OPENROUTER_API_KEY is missing or not set. ' +
        'Add it to your .env file: OPENROUTER_API_KEY=sk-or-...'
    );
    this.name = 'MissingApiKeyError';
  }
}

export class AIProviderError extends Error {
  readonly statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(`AI provider error: ${message}`);
    this.name = 'AIProviderError';
    this.statusCode = statusCode;
  }
}

export class JsonParseError extends Error {
  constructor(rawPreview: string) {
    super(
      `Failed to parse AI response as JSON after retry. ` +
        `Response preview: "${rawPreview.slice(0, 150)}"`
    );
    this.name = 'JsonParseError';
  }
}
