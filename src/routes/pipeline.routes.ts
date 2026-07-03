import { Router } from 'express';
import {
  runPipeline,
  getPipelineHistory,
  getPipelineRun,
} from '../controllers/pipeline.controller';

const router = Router();

// GET  /api/pipeline/history         — list all runs with aggregate analytics
router.get('/history', getPipelineHistory);

// GET  /api/pipeline/history/:runId  — single run detail (for future: replay, logs)
router.get('/history/:runId', getPipelineRun);

// POST /api/pipeline/run             — execute the full Stage 1 pipeline
router.post('/run', runPipeline);

export default router;
