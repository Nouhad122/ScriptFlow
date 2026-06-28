import { Router } from 'express';
import { generateIdeas } from '../controllers/ideas.controller';

const router = Router();

// POST /api/ideas/generate
router.post('/generate', generateIdeas);

export default router;
