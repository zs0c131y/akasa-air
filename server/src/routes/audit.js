import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { forbidden } from '../errors.js';
import { listAudit } from '../services/auditService.js';

export const auditRouter = Router();
auditRouter.use(requireAuth);

/** Only the HOD can read the audit log. */
auditRouter.get('/', async (req, res) => {
  if (req.user.role !== 'HOD') throw forbidden('Only the HOD can open the audit log.', 'Use the History section on a request to see its activity.');
  res.json(await listAudit(req.query));
});
