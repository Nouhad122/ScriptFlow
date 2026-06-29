import type { Request, Response } from 'express';
import { getDashboardSummary } from '../database/dashboard.repository';

export async function getSummary(_req: Request, res: Response): Promise<void> {
  try {
    const summary = await getDashboardSummary();
    res.json({ success: true, ...summary });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load dashboard summary',
    });
  }
}
