import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { dashboardStats, monthlyStats } from '../services/statsService.js';

export const statsRouter = Router();
statsRouter.use(requireAuth);

/** Numbers for the home screen, shaped by the caller's role. */
statsRouter.get('/monthly', async (req, res) => {
  const y = /^\d{4}$/.test(String(req.query.year ?? '')) ? Number(req.query.year) : undefined;
  res.json(await monthlyStats(req.user, y));
});

statsRouter.get('/', async (req, res) => res.json(await dashboardStats(req.user)));
