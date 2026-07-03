/**
 * Memory controller — POST /api/memory/search.
 *
 * THIN BY DESIGN:
 *   All semantic search logic lives in MemorySearchService.
 *   This controller's only jobs are: validate input, delegate to the service,
 *   and translate the two non-success cases into the documented response shapes.
 *
 * WHY SUCCESS WHEN THE KEY IS MISSING:
 *   A missing VOYAGE_API_KEY is a configuration choice, not a runtime failure.
 *   The system is operating normally — semantic memory is simply disabled.
 *   Returning 200 + warning lets the frontend distinguish "nothing found yet"
 *   from "search not configured" without error-handling branching.
 */

import type { Request, Response } from 'express';
import { getMemorySearchService } from '../memory';
import type { ClientContext } from '../types';

export async function searchMemory(req: Request, res: Response): Promise<void> {
  const { clientContext } = req.body as { clientContext?: ClientContext };

  if (!clientContext || !clientContext.id) {
    res.status(400).json({
      success: false,
      error: 'clientContext with a valid id is required',
    });
    return;
  }

  const service = getMemorySearchService();

  if (!service) {
    res.json({
      success: true,
      matches: [],
      warning: 'Memory search is disabled because embeddings are not configured.',
    });
    return;
  }

  try {
    const matches = await service.findSimilarContent(clientContext);
    res.json({ success: true, matches });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Memory search failed';
    console.error('[Memory] findSimilarContent failed:', errMsg);
    // Degrade gracefully — a transient embedding failure should not hard-crash the panel.
    res.json({
      success: true,
      matches: [],
      warning: `Memory search temporarily unavailable: ${errMsg}`,
    });
  }
}
