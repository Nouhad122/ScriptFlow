import type { Request, Response } from 'express';
import { aiConfig } from '../config/ai.config';
import { aiService } from '../services/AIService';
import { AIProviderError, MissingApiKeyError } from '../utils/errors';

/**
 * GET /api/health/claude
 *
 * Sends a minimal test prompt to the AI provider and reports latency.
 * Returns a detailed error response on failure — never swallows errors silently.
 *
 * The endpoint path (/api/health/claude) is preserved for backwards compatibility.
 * The underlying provider is Gemini; the path is a stable contract, not a brand name.
 */
export async function checkAIHealth(_req: Request, res: Response): Promise<void> {
  const start = Date.now();

  try {
    await aiService.generateText('Reply with the single word: HEALTHY');
    const latencyMs = Date.now() - start;

    res.json({
      success: true,
      model: aiConfig.model,
      latency: `${latencyMs}ms`,
    });
  } catch (error) {
    const latencyMs = Date.now() - start;

    if (error instanceof MissingApiKeyError) {
      res.status(503).json({
        success: false,
        error: error.name,
        message: error.message,
        latency: `${latencyMs}ms`,
      });
      return;
    }

    if (error instanceof AIProviderError) {
      res.status(502).json({
        success: false,
        error: error.name,
        message: error.message,
        statusCode: error.statusCode,
        latency: `${latencyMs}ms`,
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'UnknownError',
      message: error instanceof Error ? error.message : 'An unexpected error occurred',
      latency: `${latencyMs}ms`,
    });
  }
}
