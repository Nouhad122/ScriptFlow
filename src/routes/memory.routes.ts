import { Router } from 'express';
import { searchMemory } from '../controllers/memory.controller';

const router = Router();

// POST /api/memory/search — semantic similarity search against stored memory entries
router.post('/search', searchMemory);

export default router;
