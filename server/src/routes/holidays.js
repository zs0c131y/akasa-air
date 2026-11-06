import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { forbidden } from '../errors.js';
import { audit } from '../services/auditService.js';
import {
  addHoliday,
  addLocation,
  importHolidays,
  listHolidays,
  listLocations,
  listPeople,
  removeHoliday,
  removeLocation,
  setPersonLocation,
  setPersonManager,
  setPersonRole,
} from '../services/holidayService.js';

const onlyHod = (req, what = 'change the holiday calendar') => {
  if (req.user.role !== 'HOD') throw forbidden(`Only the HOD can ${what}.`, 'You can still see the list.');
};
const str = (v) => (typeof v === 'string' ? v : undefined);

export const holidaysRouter = Router();
holidaysRouter.use(requireAuth);

/**
 * Everyone sees the national holidays plus their own location's (that is the calendar their leave is counted with).
 * The HOD can add ?all=true or ?location=Name.
 */
holidaysRouter.get('/', async (req, res) => {
  const { from, to, location, all } = req.query;
  res.json({ items: await listHolidays(req.user, { from: str(from), to: str(to), location: str(location), all: all === 'true' }) });
});

holidaysRouter.post('/', async (req, res) => {
  onlyHod(req);
  const h = await addHoliday(req.body ?? {}, req.user);
  await audit(req, { action: 'HOLIDAY_ADDED', detail: `${h.name} on ${h.date} (${h.location ?? 'national'})` });
  res.status(201).json(h);
});

/** Body: { csv: "date,name,location\n...", apply?: boolean }. Without apply it only previews. */
holidaysRouter.post('/import', async (req, res) => {
  onlyHod(req);
  const result = await importHolidays(req.body?.csv, { apply: req.body?.apply === true }, req.user);
  if (result.applied)
    await audit(req, { action: 'HOLIDAYS_IMPORTED', detail: `${result.summary.new} added, ${result.summary.duplicate} skipped` });
  res.json(result);
});

holidaysRouter.delete('/:id', async (req, res) => {
  onlyHod(req);
  const h = await removeHoliday(req.params.id);
  await audit(req, { action: 'HOLIDAY_REMOVED', detail: `${h.name} on ${h.date} (${h.location ?? 'national'})` });
  res.json(h);
});

export const locationsRouter = Router();
locationsRouter.use(requireAuth);

locationsRouter.get('/', async (_req, res) => res.json({ items: await listLocations() }));

locationsRouter.post('/', async (req, res) => {
  onlyHod(req, 'add locations');
  const l = await addLocation(req.body?.name);
  await audit(req, { action: 'LOCATION_ADDED', detail: l.name });
  res.status(201).json(l);
});

locationsRouter.delete('/:id', async (req, res) => {
  onlyHod(req, 'remove locations');
  const l = await removeLocation(req.params.id);
  await audit(req, { action: 'LOCATION_REMOVED', detail: l.name });
  res.json(l);
});

export const peopleRouter = Router();
peopleRouter.use(requireAuth);

/** Who works where. HOD only. */
peopleRouter.get('/', async (req, res) => {
  onlyHod(req, 'see the people list');
  res.json({ items: await listPeople() });
});

peopleRouter.patch('/:id/manager', async (req, res) => {
  onlyHod(req, "choose someone's manager");
  const p = await setPersonManager(req.params.id, req.body?.managerId);
  await audit(req, { action: 'MANAGER_ASSIGNED', employeeName: p.name, detail: `${p.name} now reports to ${p.managerName}` });
  res.json(p);
});

peopleRouter.patch('/:id/role', async (req, res) => {
  onlyHod(req, "change someone's role");
  const p = await setPersonRole(req.params.id, req.body?.role);
  await audit(req, { action: 'ROLE_CHANGED', employeeName: p.name, detail: `${p.name}: ${p.from} to ${p.role}` });
  res.json(p);
});

peopleRouter.patch('/:id/location', async (req, res) => {
  onlyHod(req, 'change where someone works');
  const p = await setPersonLocation(req.params.id, req.body?.location);
  await audit(req, {
    action: 'LOCATION_CHANGED',
    employeeName: p.name,
    detail: `${p.name}: ${p.from ?? 'none'} to ${p.location ?? 'none'}`,
  });
  res.json({ id: p.id, name: p.name, role: p.role, location: p.location });
});
