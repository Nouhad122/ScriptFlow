import { Router } from 'express';
import { generateScript } from '../controllers/scripts.controller';

const router = Router();

// POST /api/scripts/generate  — generate a script for one approved idea
router.post('/generate', generateScript);

export default router;
