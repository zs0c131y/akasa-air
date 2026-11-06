import { todayISO } from '@lms/shared';
import { Allowance } from '../models/Allowance.js';
import { Setting } from '../models/Setting.js';
import { LeaveRequest } from '../models/LeaveRequest.js';
import { User } from '../models/User.js';
import { AppError, validationError } from '../errors.js';
import { parseDelimited } from './holidayImport.js';

const PENDING = ['PENDING_MANAGER', 'PENDING_HOD', 'INFO_REQUESTED'];
const DEFAULT_KEY = 'defaultAllowance';
const MAX_ROWS = 2000;

/** The yearly allowance everyone gets unless the HOD set a different number for them: 30 days to begin with. */
export async function defaultAllowance() {
  const row = await Setting.findOne({ key: DEFAULT_KEY }).lean();
  if (typeof row?.value === 'number') return row.value;
  const fromEnv = Number(process.env.LEAVE_ALLOWANCE_DAYS);
  return Number.isFinite(fromEnv) && fromEnv >= 0 ? fromEnv : 30;
}

export async function allowanceFor(userId, year) {
  const own = await Allowance.findOne({ userId, year }).lean();
  return own ? { days: own.days, custom: true } : { days: await defaultAllowance(), custom: false };
}

/** How much of a year's allowance has been used (approved), is spoken for (waiting for an answer), and is left. */
export async function balanceFor(userId, year = Number(todayISO().slice(0, 4))) {
  const prefix = `${year}-`;
  const [{ days: allowance, custom }, rows] = await Promise.all([
    allowanceFor(userId, year),
    LeaveRequest.find(
      { employeeId: userId, status: { $in: ['APPROVED', ...PENDING] }, fromDate: { $regex: `^${prefix}` } },
      { days: 1, status: 1 },
    ).lean(),
  ]);
  const used = rows.filter((r) => r.status === 'APPROVED').reduce((n, r) => n + r.days, 0);
  const pending = rows.filter((r) => PENDING.includes(r.status)).reduce((n, r) => n + r.days, 0);
  return { year, allowance, custom, used, pending, remaining: allowance - used - pending };
}

/** Stops a request that would take more days than are left. `excludeId` is the request being edited. */
export async function assertEnoughLeave(userId, fromDate, days, excludeId = null) {
  const year = Number(fromDate.slice(0, 4));
  const b = await balanceFor(userId, year);
  let remaining = b.remaining;
  if (excludeId) {
    const own = await LeaveRequest.findById(excludeId, { days: 1, status: 1, fromDate: 1 }).lean();
    if (own && [...PENDING, 'APPROVED'].includes(own.status) && own.fromDate.startsWith(`${year}-`)) remaining += own.days;
  }
  if (days > remaining) {
    const left = Math.max(remaining, 0);
    throw new AppError(
      409,
      'NOT_ENOUGH_LEAVE',
      `This needs ${days} leave day${days === 1 ? '' : 's'}, but you only have ${left} left for ${year}.`,
      `Your allowance is ${b.allowance} days (${b.used} used, ${b.pending} waiting for an answer). Shorten the request, or ask the HOD to change your allowance.`,
      { toDate: `Only ${left} day${left === 1 ? '' : 's'} left for ${year}.` },
    );
  }
}

const pubAllowance = (u, a) => ({ id: String(u._id), name: u.name, email: u.email, role: u.role, ...a });

/** Everyone's allowance for a year, with how much is used, for the HOD. */
export async function listAllowances(year = Number(todayISO().slice(0, 4))) {
  const [users, custom, leaves, base] = await Promise.all([
    User.find({}, { name: 1, email: 1, role: 1, employeeCode: 1 }).sort({ name: 1 }).lean(),
    Allowance.find({ year }).lean(),
    LeaveRequest.find(
      { status: { $in: ['APPROVED', ...PENDING] }, fromDate: { $regex: `^${year}-` } },
      { employeeId: 1, days: 1, status: 1 },
    ).lean(),
    defaultAllowance(),
  ]);
  const own = Object.fromEntries(custom.map((c) => [String(c.userId), c.days]));
  const used = {};
  const pending = {};
  for (const l of leaves) {
    const k = String(l.employeeId);
    if (l.status === 'APPROVED') used[k] = (used[k] ?? 0) + l.days;
    else pending[k] = (pending[k] ?? 0) + l.days;
  }
  return {
    year,
    defaultDays: base,
    items: users.map((u) => {
      const k = String(u._id);
      const allowance = own[k] ?? base;
      return {
        ...pubAllowance(u, { allowance, custom: k in own, used: used[k] ?? 0, pending: pending[k] ?? 0 }),
        employeeCode: u.employeeCode ?? null,
        remaining: allowance - (used[k] ?? 0) - (pending[k] ?? 0),
      };
    }),
  };
}

const validDays = (n) => Number.isFinite(n) && n >= 0 && n <= 365 && Math.round(n * 2) === n * 2; // whole or half days

export async function setDefault(days) {
  const n = Number(days);
  if (!validDays(n)) throw validationError({ days: 'Please enter a number of days between 0 and 365 (half days are fine).' });
  await Setting.updateOne({ key: DEFAULT_KEY }, { $set: { value: n } }, { upsert: true });
  return n;
}

export async function setAllowance(userId, year, days, by) {
  const user = await User.findById(userId).catch(() => null);
  if (!user) throw new AppError(404, 'NOT_FOUND', 'We could not find that person.');
  const n = Number(days);
  const y = Number(year);
  if (!validDays(n)) throw validationError({ days: 'Please enter a number of days between 0 and 365 (half days are fine).' });
  if (!Number.isInteger(y) || y < 2000 || y > 2100) throw validationError({ year: 'Please enter a year such as 2026.' });
  await Allowance.updateOne({ userId: user._id, year: y }, { $set: { days: n, setBy: by } }, { upsert: true });
  return { id: String(user._id), name: user.name, year: y, days: n };
}

/** Back to the default for that person and year. */
export async function clearAllowance(userId, year) {
  const user = await User.findById(userId).catch(() => null);
  if (!user) throw new AppError(404, 'NOT_FOUND', 'We could not find that person.');
  await Allowance.deleteOne({ userId: user._id, year: Number(year) });
  return { id: String(user._id), name: user.name };
}

const COLUMN_ALIASES = {
  email: ['email', 'e-mail', 'person', 'employee'],
  days: ['allowance', 'days', 'leave', 'quota', 'entitlement'],
  year: ['year'],
};
const EVERYONE = ['', '*', 'default', 'everyone', 'all', 'everybody'];

/**
 * Bulk allowances from pasted CSV (same rules as the holiday import). Columns: email, allowance, year (optional).
 * A row whose email is `default`, `everyone` or `*` sets the default for everybody. Checked line by line first;
 * with apply:true nothing is saved unless every line is valid.
 */
export async function importAllowances(text, { apply = false } = {}) {
  if (typeof text !== 'string' || !text.trim())
    throw validationError({ csv: 'Paste or upload some lines first. Each line is: email, allowance, year.' });
  const rows = parseDelimited(text);
  if (rows.length === 0) throw validationError({ csv: 'We could not find any lines. Each line is: email, allowance, year.' });
  const head = rows[0].cells.map((c) => c.toLowerCase());
  const hasHeader = head.some((c) => [...COLUMN_ALIASES.email, ...COLUMN_ALIASES.days].includes(c));
  const col = (key, fallback) => {
    if (!hasHeader) return fallback;
    const i = head.findIndex((h) => COLUMN_ALIASES[key].includes(h));
    return i >= 0 ? i : fallback;
  };
  const ci = { email: col('email', 0), days: col('days', 1), year: col('year', 2) };
  const body = hasHeader ? rows.slice(1) : rows;
  if (body.length > MAX_ROWS) throw validationError({ csv: `That is ${body.length} lines. Please import at most ${MAX_ROWS} at a time.` });

  const thisYear = Number(todayISO().slice(0, 4));
  const users = await User.find({}, { name: 1, email: 1 }).lean();
  const byEmail = Object.fromEntries(users.map((u) => [u.email.toLowerCase(), u]));
  const current = await Allowance.find({}).lean();
  const existing = new Map(current.map((c) => [`${c.userId}|${c.year}`, c.days]));
  const base = await defaultAllowance();
  const seen = new Set();
  const out = [];
  for (const { line, cells } of body) {
    const who = (cells[ci.email] ?? '').trim().toLowerCase();
    const days = Number(cells[ci.days]);
    const yearRaw = (cells[ci.year] ?? '').trim();
    const year = yearRaw === '' ? thisYear : Number(yearRaw);
    let status = 'new';
    let message = '';
    const everyone = EVERYONE.includes(who);
    if (!everyone && !byEmail[who]) {
      status = 'error';
      message = `We do not have anyone with the email "${cells[ci.email] ?? ''}".`;
    } else if (!(cells[ci.days] ?? '').trim() || !validDays(days)) {
      status = 'error';
      message = `"${cells[ci.days] ?? ''}" is not a number of days between 0 and 365.`;
    } else if (!everyone && (!Number.isInteger(year) || year < 2000 || year > 2100)) {
      status = 'error';
      message = `"${yearRaw}" is not a year we can read. Try 2026.`;
    } else {
      const key = everyone ? 'default' : `${byEmail[who]._id}|${year}`;
      if (seen.has(key)) {
        status = 'error';
        message = 'This person is listed twice. Keep one line for them.';
      } else {
        seen.add(key);
        const before = everyone ? base : existing.get(key);
        if (before === days) {
          status = 'same';
          message = 'Already set to this, so nothing changes.';
        } else if (before !== undefined) {
          status = 'changed';
          message = `Changes from ${before} days to ${days}.`;
        }
      }
    }
    out.push({
      line,
      who: everyone ? 'Everyone (the default)' : (byEmail[who]?.name ?? who),
      email: everyone ? null : who,
      days: Number.isFinite(days) ? days : null,
      year: everyone ? null : year,
      status,
      message,
    });
  }
  const summary = {
    new: out.filter((r) => r.status === 'new').length,
    changed: out.filter((r) => r.status === 'changed').length,
    same: out.filter((r) => r.status === 'same').length,
    errors: out.filter((r) => r.status === 'error').length,
  };
  let applied = false;
  if (apply && summary.errors === 0 && summary.new + summary.changed > 0) {
    for (const r of out.filter((x) => x.status === 'new' || x.status === 'changed')) {
      if (r.email === null) await setDefault(r.days);
      else await Allowance.updateOne({ userId: byEmail[r.email]._id, year: r.year }, { $set: { days: r.days } }, { upsert: true });
    }
    applied = true;
  }
  return { applied, summary, rows: out };
}
