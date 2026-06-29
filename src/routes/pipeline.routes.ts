import { Router } from 'express';
import { runPipeline } from '../controllers/pipeline.controller';

const router = Router();

// POST /api/pipeline/run  — run the full Stage 1 pipeline for a client
router.post('/run', runPipeline);

export default router;
