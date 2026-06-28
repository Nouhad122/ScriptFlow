import { Router } from 'express';
import { checkClaudeHealth } from '../controllers/health.controller';

const router = Router();

// GET /api/health/claude
router.get('/claude', checkClaudeHealth);

export default router;
