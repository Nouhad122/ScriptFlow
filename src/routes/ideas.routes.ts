import { Router } from 'express';
import { generateIdeas, scoreIdeas } from '../controllers/ideas.controller';

const router = Router();

// POST /api/ideas/generate
router.post('/generate', generateIdeas);

// POST /api/ideas/score
router.post('/score', scoreIdeas);

export default router;
