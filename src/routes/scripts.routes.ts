import { Router } from 'express';
import { generateScript } from '../controllers/scripts.controller';
import { reviewScript } from '../controllers/quality.controller';

const router = Router();

// POST /api/scripts/generate          — generate a script for one approved idea
router.post('/generate', generateScript);

// POST /api/scripts/:scriptId/review  — run quality review on a generated script
router.post('/:scriptId/review', reviewScript);

export default router;
