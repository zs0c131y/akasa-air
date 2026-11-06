import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { forbidden, validationError } from '../errors.js';
import { audit } from '../services/auditService.js';
import { todayISO } from '@lms/shared';
import {
  balanceFor,
  clearAllowance,
  defaultAllowance,
  importAllowances,
  listAllowances,
  setAllowance,
  setDefault,
} from '../services/allowanceService.js';
import { listFor, markRead } from '../services/notificationService.js';
import { User } from '../models/User.js';

const onlyHod = (req, what) => {
  if (req.user.role !== 'HOD') throw forbidden(`Only the HOD can ${what}.`, 'You can still see your own balance.');
};
const yearOf = (v) => (/^\d{4}$/.test(String(v ?? '')) ? Number(v) : Number(todayISO().slice(0, 4)));

/** Your own leave balance for a year. */
export const balanceRouter = Router();
balanceRouter.use(requireAuth);
balanceRouter.get('/', async (req, res) => res.json(await balanceFor(req.user.id, yearOf(req.query.year))));

/** HOD: the default allowance, each person's allowance, and the CSV import. */
export const allowancesRouter = Router();
allowancesRouter.use(requireAuth);

allowancesRouter.get('/', async (req, res) => {
  onlyHod(req, "see everyone's allowance");
  res.json(await listAllowances(yearOf(req.query.year)));
});

allowancesRouter.put('/default', async (req, res) => {
  onlyHod(req, 'change the default allowance');
  const days = await setDefault(req.body?.days);
  await audit(req, { action: 'ALLOWANCE_CHANGED', detail: `Default yearly allowance is now ${days} days` });
  res.json({ days });
});

allowancesRouter.post('/import', async (req, res) => {
  onlyHod(req, 'import allowances');
  const result = await importAllowances(req.body?.csv, { apply: req.body?.apply === true });
  if (result.applied)
    await audit(req, { action: 'ALLOWANCES_IMPORTED', detail: `${result.summary.new} new, ${result.summary.changed} changed` });
  res.json(result);
});

allowancesRouter.put('/:userId', async (req, res) => {
  onlyHod(req, "change someone's allowance");
  const r = await setAllowance(req.params.userId, req.body?.year ?? todayISO().slice(0, 4), req.body?.days, req.user.name);
  await audit(req, { action: 'ALLOWANCE_CHANGED', employeeName: r.name, detail: `${r.name}: ${r.days} days for ${r.year}` });
  res.json(r);
});

allowancesRouter.delete('/:userId', async (req, res) => {
  onlyHod(req, "change someone's allowance");
  const year = yearOf(req.query.year);
  const r = await clearAllowance(req.params.userId, year);
  await audit(req, { action: 'ALLOWANCE_CHANGED', employeeName: r.name, detail: `${r.name}: back to the default for ${year}` });
  res.json({ ...r, defaultDays: await defaultAllowance() });
});

/** In-app notices for the signed-in person. */
export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);
notificationsRouter.get('/', async (req, res) => res.json(await listFor(req.user.id, { limit: req.query.limit })));
notificationsRouter.post('/read', async (req, res) => {
  if (!req.body?.all && !Array.isArray(req.body?.ids))
    throw validationError({ ids: 'Say which notices to mark as read, or send all: true.' });
  res.json(await markRead(req.user.id, { ids: req.body?.ids, all: req.body?.all === true }));
});

/** The signed-in person's own settings. */
export const preferencesRouter = Router();
preferencesRouter.use(requireAuth);
preferencesRouter.patch('/', async (req, res) => {
  if (typeof req.body?.emailNotifications !== 'boolean') throw validationError({ emailNotifications: 'Choose on or off.' });
  await User.updateOne({ _id: req.user.id }, { emailNotifications: req.body.emailNotifications });
  res.json({ emailNotifications: req.body.emailNotifications });
});
