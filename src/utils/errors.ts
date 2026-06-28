/**
 * Custom error classes for the Claude infrastructure layer.
 *
 * Using named classes instead of generic Error objects allows callers to use
 * instanceof checks for precise error handling without string matching.
 *
 * Example:
 *   catch (error) {
 *     if (error instanceof MissingApiKeyError) { ... }
 *     if (error instanceof ClaudeApiError) { ... }
 *   }
 */

export class MissingApiKeyError extends Error {
  constructor() {
    super(
      'ANTHROPIC_API_KEY is missing or not set. ' +
        'Add it to your .env file: ANTHROPIC_API_KEY=sk-ant-...'
    );
    this.name = 'MissingApiKeyError';
  }
}

export class ClaudeApiError extends Error {
  readonly statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(`Claude API error: ${message}`);
    this.name = 'ClaudeApiError';
    this.statusCode = statusCode;
  }
}

export class JsonParseError extends Error {
  constructor(rawPreview: string) {
    super(
      `Failed to parse Claude response as JSON after retry. ` +
        `Response preview: "${rawPreview.slice(0, 150)}"`
    );
    this.name = 'JsonParseError';
  }
}
