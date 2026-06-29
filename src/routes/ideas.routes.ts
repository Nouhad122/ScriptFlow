import { Router } from 'express';
import {
  generateIdeas,
  scoreIdeas,
  saveIdeas,
  getPendingIdeas,
  approveIdea,
} from '../controllers/ideas.controller';

const router = Router();

// POST /api/ideas/generate  — AI: generate idea batch
router.post('/generate', generateIdeas);

// POST /api/ideas/score     — AI: attach ICE scores to a batch
router.post('/score', scoreIdeas);

// POST /api/ideas/save      — DB: persist scored ideas
router.post('/save', saveIdeas);

// GET  /api/ideas/pending   — DB: human approval queue
router.get('/pending', getPendingIdeas);

// PATCH /api/ideas/:id/approval  — DB: approve or reject an idea
router.patch('/:id/approval', approveIdea);

export default router;
