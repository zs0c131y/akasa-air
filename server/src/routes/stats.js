import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { dashboardStats } from '../services/statsService.js';

export const statsRouter = Router();
statsRouter.use(requireAuth);

/** Numbers for the home screen, shaped by the caller's role. */
statsRouter.get('/', async (req, res) => res.json(await dashboardStats(req.user)));
