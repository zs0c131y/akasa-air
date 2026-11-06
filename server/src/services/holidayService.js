import { Holiday } from '../models/Holiday.js';
import { Location } from '../models/Location.js';
import { User } from '../models/User.js';
import { AppError, validationError } from '../errors.js';
import { normalizeDate, parseHolidayRows } from './holidayImport.js';

const pub = (h) => ({ id: String(h._id), date: h.date, name: h.name, location: h.location ?? null });

const NATIONAL_WORDS = ['', 'national', 'all', 'everyone', 'india', 'all locations', 'common'];
const MAX_IMPORT_ROWS = 1000;

/** Holidays that apply to one person: the national ones plus those of their own location. */
export async function holidaysFor(user, { from, to } = {}) {
  const filter = { location: { $in: [null, user?.location ?? null] } };
  if (from || to) filter.date = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
  return Holiday.find(filter).sort({ date: 1 }).lean();
}

/**
 * The calendar as a user sees it. Everyone gets the national holidays plus their own location's.
 * The HOD can ask for `all` locations or one named location.
 */
export async function listHolidays(user, { from, to, location, all } = {}) {
  const range = from || to ? { date: { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) } } : {};
  let filter;
  if (user.role === 'HOD' && all) filter = range;
  else if (user.role === 'HOD' && location) filter = { ...range, location: { $in: [null, location] } };
  else filter = { ...range, location: { $in: [null, user.location ?? null] } };
  return (await Holiday.find(filter).sort({ date: 1, location: 1 }).lean()).map(pub);
}

async function resolveLocation(raw) {
  const name = String(raw ?? '').trim();
  if (NATIONAL_WORDS.includes(name.toLowerCase())) return { location: null };
  const found = await Location.findOne({ name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }).lean();
  if (!found) return { error: `We do not have a location called "${name}". Add it under Locations first, or fix the spelling.` };
  return { location: found.name };
}

export async function addHoliday({ date, name, location }, user) {
  const fields = {};
  const iso = normalizeDate(date);
  if (iso === null) fields.date = 'Please pick a valid date.';
  const clean = typeof name === 'string' ? name.trim() : '';
  if (clean.length < 2) fields.name = 'Please give the holiday a name, for example "Diwali".';
  if (clean.length > 80) fields.name = 'Please keep the name under 80 characters.';
  const place = await resolveLocation(location);
  if (place.error) fields.location = place.error;
  if (Object.keys(fields).length) throw validationError(fields);
  try {
    return pub(await Holiday.create({ date: iso, name: clean, location: place.location, addedBy: user.name }));
  } catch (err) {
    if (err?.code === 11000) {
      throw new AppError(409, 'HOLIDAY_EXISTS', 'That date is already a holiday for this location.', 'Remove the existing entry first if you want to rename it.', { date: 'Already listed.' });
    }
    throw err;
  }
}

export async function removeHoliday(id) {
  const h = await Holiday.findByIdAndDelete(id).catch(() => null);
  if (!h) throw new AppError(404, 'NOT_FOUND', 'We could not find that holiday.');
  return pub(h);
}

/**
 * Bulk add from pasted CSV (or a spreadsheet pasted as tab-separated text).
 * Columns: date, name, location (blank or "National" = applies everywhere). A header row is optional.
 * Always checks every row first. With `apply: false` nothing is saved (a preview). With `apply: true` rows are saved
 * only if none has an error, so a typo never leaves half a calendar behind. Dates already listed are skipped.
 */
export async function importHolidays(text, { apply = false } = {}, user) {
  if (typeof text !== 'string' || !text.trim()) {
    throw validationError({ csv: 'Paste or upload some holidays first. Each line is: date, name, location.' });
  }
  const raw = parseHolidayRows(text);
  if (raw.length === 0) throw validationError({ csv: 'We could not find any holiday lines. Each line is: date, name, location.' });
  if (raw.length > MAX_IMPORT_ROWS) {
    throw validationError({ csv: `That is ${raw.length} lines. Please import at most ${MAX_IMPORT_ROWS} at a time.` });
  }
  const existing = new Set((await Holiday.find({}, { date: 1, location: 1 }).lean()).map((h) => `${h.date}|${h.location ?? ''}`));
  const seen = new Set();
  const rows = [];
  for (const r of raw) {
    const iso = normalizeDate(r.date);
    const name = r.name.trim();
    const place = await resolveLocation(r.location);
    let status = 'new';
    let message = '';
    if (iso === null) { status = 'error'; message = `"${r.date}" is not a date we can read. Try 2026-10-02 or 02/10/2026.`; } else if (name.length < 2) { status = 'error'; message = 'This line has no holiday name.'; } else if (name.length > 80) { status = 'error'; message = 'The name is longer than 80 characters.'; } else if (place.error) { status = 'error'; message = place.error; } else {
      const key = `${iso}|${place.location ?? ''}`;
      if (existing.has(key) || seen.has(key)) { status = 'duplicate'; message = 'Already in the calendar, so it will be skipped.'; }
      seen.add(key);
    }
    rows.push({ line: r.line, date: iso ?? r.date, name, location: place.location ?? null, status, message });
  }
  const summary = {
    new: rows.filter((r) => r.status === 'new').length,
    duplicate: rows.filter((r) => r.status === 'duplicate').length,
    errors: rows.filter((r) => r.status === 'error').length,
  };
  let applied = false;
  if (apply && summary.errors === 0 && summary.new > 0) {
    await Holiday.insertMany(rows.filter((r) => r.status === 'new').map((r) => ({ date: r.date, name: r.name, location: r.location, addedBy: user.name })));
    applied = true;
  }
  return { applied, summary, rows };
}

/* ---------- Locations and people ---------- */

export async function listLocations() {
  const [locs, people, holidays] = await Promise.all([
    Location.find().sort({ name: 1 }).lean(),
    User.aggregate([{ $match: { location: { $ne: null } } }, { $group: { _id: '$location', n: { $sum: 1 } } }]),
    Holiday.aggregate([{ $match: { location: { $ne: null } } }, { $group: { _id: '$location', n: { $sum: 1 } } }]),
  ]);
  const count = (rows) => Object.fromEntries(rows.map((r) => [r._id, r.n]));
  const p = count(people);
  const h = count(holidays);
  return locs.map((l) => ({ id: String(l._id), name: l.name, people: p[l.name] ?? 0, holidays: h[l.name] ?? 0 }));
}

export async function addLocation(name) {
  const clean = typeof name === 'string' ? name.trim() : '';
  if (clean.length < 2 || clean.length > 60) throw validationError({ name: 'Please give the location a name of 2 to 60 characters, for example "Bengaluru".' });
  if (NATIONAL_WORDS.includes(clean.toLowerCase())) throw validationError({ name: `"${clean}" is reserved for holidays that apply everywhere.` });
  try {
    const l = await Location.create({ name: clean });
    return { id: String(l._id), name: l.name, people: 0, holidays: 0 };
  } catch (err) {
    if (err?.code === 11000) throw new AppError(409, 'LOCATION_EXISTS', 'That location already exists.', null, { name: 'Already listed.' });
    throw err;
  }
}

export async function removeLocation(id) {
  const l = await Location.findById(id).catch(() => null);
  if (!l) throw new AppError(404, 'NOT_FOUND', 'We could not find that location.');
  const [people, holidays] = await Promise.all([User.countDocuments({ location: l.name }), Holiday.countDocuments({ location: l.name })]);
  if (people > 0 || holidays > 0) {
    throw new AppError(409, 'LOCATION_IN_USE', `${l.name} still has ${people} ${people === 1 ? 'person' : 'people'} and ${holidays} holiday${holidays === 1 ? '' : 's'}.`, 'Move the people to another location and remove its holidays first.');
  }
  await l.deleteOne();
  return { id: String(l._id), name: l.name };
}

export async function listPeople() {
  const users = await User.find({}, { name: 1, role: 1, location: 1, managerId: 1 }).sort({ role: 1, name: 1 }).lean();
  return users.map((u) => ({ id: String(u._id), name: u.name, role: u.role, location: u.location ?? null }));
}

export async function setPersonLocation(id, rawLocation) {
  const user = await User.findById(id).catch(() => null);
  if (!user) throw new AppError(404, 'NOT_FOUND', 'We could not find that person.');
  const place = await resolveLocation(rawLocation);
  if (place.error) throw validationError({ location: place.error });
  const from = user.location ?? null;
  user.location = place.location;
  await user.save();
  return { id: String(user._id), name: user.name, role: user.role, location: user.location, from };
}

/** The default locations and the fixed-date holidays that go with them, created once. */
const DEFAULT_LOCATIONS = ['Bengaluru', 'Mumbai', 'Delhi'];
const FIXED_NATIONAL = [['01-26', 'Republic Day'], ['08-15', 'Independence Day'], ['10-02', 'Gandhi Jayanti'], ['12-25', 'Christmas Day']];
const FIXED_LOCAL = [['Bengaluru', '11-01', 'Kannada Rajyotsava'], ['Mumbai', '05-01', 'Maharashtra Day']];

export async function seedLocationsIfEmpty() {
  if ((await Location.countDocuments()) > 0) return false;
  await Location.insertMany(DEFAULT_LOCATIONS.map((name) => ({ name })));
  return true;
}

/** Seeds fixed-date holidays for this and next year, only when the calendar is empty. */
export async function seedHolidaysIfEmpty(year = new Date().getFullYear()) {
  if ((await Holiday.countDocuments()) > 0) return false;
  const years = [year, year + 1];
  const rows = [
    ...years.flatMap((y) => FIXED_NATIONAL.map(([md, name]) => ({ date: `${y}-${md}`, name, location: null, addedBy: 'System' }))),
    ...years.flatMap((y) => FIXED_LOCAL.map(([location, md, name]) => ({ date: `${y}-${md}`, name, location, addedBy: 'System' }))),
  ];
  await Holiday.insertMany(rows);
  return true;
}

/** Older databases had a unique index on date alone; replace it with the (date, location) one. */
export async function migrateHolidayIndexes() {
  try {
    await Holiday.collection.dropIndex('date_1');
  } catch {
    /* no old index */
  }
  await Holiday.init();
}
