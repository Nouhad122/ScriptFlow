import { Router } from 'express';
import {
  getAllScripts,
  generateScript,
  regenerateScript,
  getScriptForIdea,
  getReviewForScript,
} from '../controllers/scripts.controller';
import { reviewScript } from '../controllers/quality.controller';

const router = Router();

// GET  /api/scripts/by-idea/:ideaId   — fetch existing script for an idea (specific literal first)
router.get('/by-idea/:ideaId', getScriptForIdea);

// GET  /api/scripts                   — list all scripts joined with idea hookLine
router.get('/', getAllScripts);

// GET  /api/scripts/:scriptId/review  — fetch existing review without triggering a new one
router.get('/:scriptId/review', getReviewForScript);

// POST /api/scripts/generate          — generate a script for one approved idea
router.post('/generate', generateScript);

// POST /api/scripts/:scriptId/review     — run quality review on a generated script
router.post('/:scriptId/review', reviewScript);

// POST /api/scripts/:ideaId/regenerate  — delete held script and regenerate with quality feedback
router.post('/:ideaId/regenerate', regenerateScript);

export default router;
