import { Router } from 'express';
import { getSummary } from '../controllers/dashboard.controller';

const router = Router();

// GET /api/dashboard/summary  — aggregated statistics for the React dashboard
router.get('/summary', getSummary);

export default router;
