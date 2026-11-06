import { z } from 'zod';

/** Leave of more than this many days in a row (calendar days away, first to last day) needs documents and HOD approval. */
export const LONG_LEAVE_THRESHOLD_DAYS = 3;
export const MAX_FILES = 5;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png'];
/** Leave cannot start in the past: the earliest start date is today. */
export const MAX_DAYS_IN_PAST = 0;
export const MAX_DAYS_IN_FUTURE = 365;
export const MAX_LEAVE_DAYS = 60;

export const ROLES = ['EMPLOYEE', 'MANAGER', 'HOD'];
export const STATUSES = ['PENDING_MANAGER', 'PENDING_HOD', 'INFO_REQUESTED', 'APPROVED', 'REJECTED', 'CANCELLED'];
export const STATUS_LABELS = {
  PENDING_MANAGER: 'Pending manager',
  PENDING_HOD: 'Awaiting HOD',
  INFO_REQUESTED: 'Info requested',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86400000;

/** Parses 'YYYY-MM-DD' to a UTC timestamp, or null if it is not a real calendar date. */
export function parseISODate(s) {
  if (typeof s !== 'string' || !ISO.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  const t = Date.UTC(y, m - 1, d);
  const dt = new Date(t);
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return t;
}

export function todayISO(now = new Date()) {
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

const holidayMap = (holidays = []) => new Map(holidays.map((h) => (typeof h === 'string' ? [h, ''] : [h.date, h.name ?? ''])));

/**
 * What a date range costs in leave. Sundays and public holidays are days off, so they are never charged.
 * `holidays` is a list of ISO date strings or `{ date, name }` objects (the company holiday calendar).
 * A holiday that falls on a Sunday is reported as a Sunday only.
 * Returns { days, calendarDays, sundays, holidays: [{ date, name }] }; days is 0 if invalid or reversed.
 */
export function leaveBreakdown(from, to, holidays = []) {
  const a = parseISODate(from);
  const b = parseISODate(to);
  const out = { days: 0, calendarDays: 0, sundays: 0, holidays: [] };
  if (a === null || b === null || b < a) return out;
  const hol = holidayMap(holidays);
  for (let t = a; t <= b; t += DAY_MS) {
    out.calendarDays += 1;
    const iso = new Date(t).toISOString().slice(0, 10);
    if (new Date(t).getUTCDay() === 0) out.sundays += 1;
    else if (hol.has(iso)) out.holidays.push({ date: iso, name: hol.get(iso) });
    else out.days += 1;
  }
  return out;
}

/** Leave days from `from` to `to`, both included, not counting Sundays or public holidays. */
export const countLeaveDays = (from, to, holidays = []) => leaveBreakdown(from, to, holidays).days;

/**
 * Leave in a row. Two requests that touch (or are separated only by Sundays and public holidays) are one stretch of
 * time off, so splitting a long leave into short ones does not avoid the document and the second approval.
 * `others` are the person's other active requests ({ id?, fromDate, toDate, days }). Returns the total counted days
 * of the whole stretch that includes [from, to], and which other requests are part of it.
 */
export function consecutiveChain(from, to, others = [], holidays = []) {
  const own = countLeaveDays(from, to, holidays);
  let start = from;
  let end = to;
  const members = [];
  const pool = others.filter((o) => parseISODate(o.fromDate) !== null && parseISODate(o.toDate) !== null);
  let grew = true;
  const dayBefore = (iso) => new Date(parseISODate(iso) - DAY_MS).toISOString().slice(0, 10);
  const dayAfter = (iso) => new Date(parseISODate(iso) + DAY_MS).toISOString().slice(0, 10);
  while (grew) {
    grew = false;
    for (const o of pool) {
      if (members.includes(o)) continue;
      const overlaps = o.fromDate <= end && o.toDate >= start;
      // Nothing but days off between the two: the gap [o.toDate+1, start-1] or [end+1, o.fromDate-1] counts as zero leave days.
      const touchesBefore = o.toDate < start && countLeaveDays(dayAfter(o.toDate), dayBefore(start), holidays) === 0;
      const touchesAfter = o.fromDate > end && countLeaveDays(dayAfter(end), dayBefore(o.fromDate), holidays) === 0;
      if (overlaps || touchesBefore || touchesAfter) {
        members.push(o);
        if (o.fromDate < start) start = o.fromDate;
        if (o.toDate > end) end = o.toDate;
        grew = true;
      }
    }
  }
  return {
    chainDays: own + members.reduce((n, o) => n + (o.days ?? countLeaveDays(o.fromDate, o.toDate, holidays)), 0),
    absenceDays: absenceDays(start, end),
    members,
    from: start,
    to: end,
  };
}

/** Human sentence for what was left out, e.g. "1 Sunday and Diwali are not counted". Empty if nothing was excluded. */
export function excludedSummary({ sundays = 0, holidays = [] }) {
  const parts = [];
  if (sundays) parts.push(`${sundays} Sunday${sundays > 1 ? 's' : ''}`);
  if (holidays.length) parts.push(holidays.map((h) => h.name || h.date).join(', '));
  if (!parts.length) return '';
  return `${parts.join(' and ')} ${parts.length > 1 || sundays > 1 || holidays.length > 1 ? 'are' : 'is'} not counted`;
}

/**
 * How many calendar days someone is away from first to last day, both included. Sundays and holidays in the middle are
 * part of being away, even though they are not charged as leave. This is what the "more than 3 days in a row" rule
 * looks at; `countLeaveDays` is what is charged.
 */
export function absenceDays(from, to) {
  const a = parseISODate(from);
  const b = parseISODate(to);
  if (a === null || b === null || b < a) return 0;
  return Math.round((b - a) / DAY_MS) + 1;
}

/** Long leave: more than 3 days in a row (see absenceDays). */
export const isLongLeave = (days) => days > LONG_LEAVE_THRESHOLD_DAYS;

/** Returns a friendly message if documents are required but missing, else null. */
export function documentRequirementError(days, documentCount, isEmergency = false) {
  if (isLongLeave(days) && documentCount < 1 && !isEmergency) {
    return `Leave longer than ${LONG_LEAVE_THRESHOLD_DAYS} days needs a supporting document. Please attach one, for example a medical certificate or a travel booking. If this is a genuine emergency, tick "Emergency leave" and send the documents afterwards.`;
  }
  return null;
}

/** Documents are only taken for leave over the threshold; shorter leave never needs (or accepts) them. */
export const documentsAccepted = (days) => isLongLeave(days);

/** Emergency leaves over the threshold may be filed without documents, but documents become owed. */
export const MAX_OUTSTANDING_EMERGENCY = 2;

/**
 * Decides if a new leave may be filed given how many emergency leaves still owe documents.
 * 0 owed: anything. 1 owed: only another emergency leave. 2+ owed: nothing until documents are sent.
 * Returns a friendly message when blocked, else null.
 */
export function emergencyBlockMessage(owedCount, isEmergency) {
  if (owedCount >= MAX_OUTSTANDING_EMERGENCY) {
    return 'You have emergency leave without supporting documents twice over, so new leave of any kind is blocked until you upload them.';
  }
  if (owedCount === 1 && !isEmergency) {
    return 'Your earlier emergency leave still needs supporting documents. Please upload them before applying for another leave (only one more emergency leave is allowed meanwhile).';
  }
  return null;
}

const isoDate = (label) =>
  z
    .string({ required_error: `${label} is required. Please pick a date.` })
    .refine((v) => parseISODate(v) !== null, `${label} is not a valid date. Use the format YYYY-MM-DD.`);

export const makeLeaveInputSchema = (holidays = []) =>
  z
    .object({
      employeeName: z.string().trim().optional(),
      isEmergency: z
        .union([z.boolean(), z.enum(['true', 'false'])])
        .optional()
        .transform((v) => v === true || v === 'true'),
      fromDate: isoDate('Start date'),
      toDate: isoDate('End date'),
      reason: z
        .string({ required_error: 'Please tell us the reason for your leave.' })
        .trim()
        .min(5, 'Please give a reason of at least 5 characters, for example "Family wedding".')
        .max(500, 'Please keep the reason under 500 characters.'),
    })
    .superRefine((v, ctx) => {
      const from = parseISODate(v.fromDate);
      const to = parseISODate(v.toDate);
      if (from === null || to === null) return;
      if (to < from) {
        ctx.addIssue({
          code: 'custom',
          path: ['toDate'],
          message: 'End date is before the start date. Please pick an end date on or after the start date.',
        });
        return;
      }
      const counted = countLeaveDays(v.fromDate, v.toDate, holidays);
      if (counted === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['toDate'],
          message:
            'Sundays and public holidays are not counted as leave, so this request has no leave days. Please include at least one working day.',
        });
        return;
      }
      if (counted > MAX_LEAVE_DAYS) {
        ctx.addIssue({
          code: 'custom',
          path: ['toDate'],
          message: `A single request can cover at most ${MAX_LEAVE_DAYS} days. Please split it into two requests.`,
        });
      }
      const today = parseISODate(todayISO());
      if (from < today - MAX_DAYS_IN_PAST * DAY_MS) {
        ctx.addIssue({
          code: 'custom',
          path: ['fromDate'],
          message: 'Start date is in the past. Please pick today or a later date.',
        });
      }
      if (to > today + MAX_DAYS_IN_FUTURE * DAY_MS) {
        ctx.addIssue({
          code: 'custom',
          path: ['toDate'],
          message: `Leave can be requested up to ${MAX_DAYS_IN_FUTURE} days ahead. Please pick an earlier end date.`,
        });
      }
    });

/** Schema without a holiday calendar (Sundays only); the server and the apply form use makeLeaveInputSchema(holidays). */
export const leaveInputSchema = makeLeaveInputSchema();

export const approveSchema = z.object({ comment: z.string().trim().max(1000).optional() });
export const rejectSchema = z.object({
  comment: z
    .string({ required_error: 'Please explain why the request is rejected.' })
    .trim()
    .min(3, 'Please explain why the request is rejected (at least 3 characters).')
    .max(1000, 'Please keep the comment under 1000 characters.'),
});
export const infoRequestSchema = z.object({
  comment: z
    .string({ required_error: 'Please write what information you need.' })
    .trim()
    .min(3, 'Please write what information you need (at least 3 characters).')
    .max(1000, 'Please keep the question under 1000 characters.'),
});
export const replySchema = z.object({
  message: z.string().trim().max(1000, 'Please keep the reply under 1000 characters.').optional(),
});

/** Passwords: at least 8 characters with a letter and a number, and nothing obvious. Returns a friendly message, or null if fine. */
const COMMON_PASSWORDS = [
  'password',
  '12345678',
  '123456789',
  'qwertyuiop',
  'iloveyou1',
  'welcome1',
  'letmein1',
  'abcd1234',
  'password1',
  'password123',
];
export function passwordProblem(password, { email = '', name = '' } = {}) {
  const p = String(password ?? '');
  if (p.length < 8) return 'Use at least 8 characters.';
  if (p.length > 128) return 'Please keep it under 128 characters.';
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return 'Include at least one letter and one number.';
  const lower = p.toLowerCase();
  if (COMMON_PASSWORDS.some((c) => lower === c)) return 'That password is too easy to guess. Try something less common.';
  const local = String(email).split('@')[0].toLowerCase();
  if (local.length >= 4 && lower.includes(local)) return 'Please do not use your email name in your password.';
  const first = String(name).trim().split(/\s+/)[0].toLowerCase();
  if (first.length >= 4 && lower.includes(first)) return 'Please do not use your own name in your password.';
  return null;
}

const emailField = z
  .string({ required_error: 'Please enter your email address.' })
  .trim()
  .toLowerCase()
  .max(254, 'That email address is too long.')
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, 'That does not look like an email address. Check for typos.');

export const signupSchema = z
  .object({
    name: z
      .string({ required_error: 'Please tell us your name.' })
      .trim()
      .min(3, 'Please enter your full name (at least 3 letters).')
      .max(100, 'Please keep your name under 100 characters.'),
    email: emailField,
    password: z.string({ required_error: 'Please choose a password.' }),
  })
  .superRefine((v, ctx) => {
    const problem = passwordProblem(v.password, { email: v.email, name: v.name });
    if (problem) ctx.addIssue({ code: 'custom', path: ['password'], message: problem });
  });

export const forgotSchema = z.object({ email: emailField });
export const resetSchema = z.object({
  token: z.string({ required_error: 'This link is missing its code.' }).min(20, 'This link is not valid.').max(200),
  password: z.string({ required_error: 'Please choose a new password.' }),
});
export const changePasswordSchema = z.object({
  currentPassword: z.string({ required_error: 'Please enter your current password.' }).min(1, 'Please enter your current password.'),
  newPassword: z.string({ required_error: 'Please choose a new password.' }),
});

/** Converts a zod error to { fieldName: message }. */
export function zodFields(error) {
  const fields = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    if (!(key in fields)) fields[key] = issue.message;
  }
  return fields;
}
