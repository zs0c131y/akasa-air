import { z } from 'zod';

/** Leave longer than this many consecutive (inclusive calendar) days needs documents + HOD approval. */
export const LONG_LEAVE_THRESHOLD_DAYS = 3;
export const MAX_FILES = 5;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png'];
export const MAX_DAYS_IN_PAST = 365;
export const MAX_DAYS_IN_FUTURE = 365;
export const MAX_LEAVE_DAYS = 60;

export const ROLES = ['EMPLOYEE', 'MANAGER', 'HOD'];
export const STATUSES = [
  'PENDING_MANAGER',
  'PENDING_HOD',
  'INFO_REQUESTED',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
];
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

/** Inclusive calendar days from `from` to `to` (same day = 1). Returns 0 if invalid or reversed. */
export function countLeaveDays(from, to) {
  const a = parseISODate(from);
  const b = parseISODate(to);
  if (a === null || b === null || b < a) return 0;
  return Math.round((b - a) / DAY_MS) + 1;
}

export const isLongLeave = (days) => days > LONG_LEAVE_THRESHOLD_DAYS;

/** Returns a friendly message if documents are required but missing, else null. */
export function documentRequirementError(days, documentCount, isEmergency = false) {
  if (isLongLeave(days) && documentCount < 1 && !isEmergency) {
    return `Leave longer than ${LONG_LEAVE_THRESHOLD_DAYS} days needs a supporting document. Please attach one, for example a medical certificate or a travel booking. If this is a genuine emergency, tick "Emergency leave" and send the documents afterwards.`;
  }
  return null;
}

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

export const leaveInputSchema = z
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
    if (countLeaveDays(v.fromDate, v.toDate) > MAX_LEAVE_DAYS) {
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
        message: `Start date is more than ${MAX_DAYS_IN_PAST} days in the past. Please pick a more recent date or contact your HOD.`,
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

/** Converts a zod error to { fieldName: message }. */
export function zodFields(error) {
  const fields = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    if (!(key in fields)) fields[key] = issue.message;
  }
  return fields;
}
