import type { Request, Response } from 'express';
import { claudeConfig } from '../config/claude.config';
import { claudeService } from '../services/ClaudeService';
import { ClaudeApiError, MissingApiKeyError } from '../utils/errors';

/**
 * GET /api/health/claude
 *
 * Sends a minimal test prompt to Claude and reports latency.
 * Returns a detailed error response on failure — never swallows errors silently.
 */
export async function checkClaudeHealth(_req: Request, res: Response): Promise<void> {
  const start = Date.now();

  try {
    await claudeService.generateText('Reply with the single word: HEALTHY');
    const latencyMs = Date.now() - start;

    res.json({
      success: true,
      model: claudeConfig.model,
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

    if (error instanceof ClaudeApiError) {
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
