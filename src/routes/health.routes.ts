import { Router } from 'express';
import { checkAIHealth } from '../controllers/health.controller';

const router = Router();

// GET /api/health/claude
router.get('/claude', checkAIHealth);

export default router;
