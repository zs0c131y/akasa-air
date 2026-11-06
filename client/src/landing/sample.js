import { excludedSummary, leaveBreakdown } from '@lms/shared';

/**
 * Sample data for the public page's mock screens. Day counts are worked out by the same helper the app and the
 * server use, against a small holiday list, so the numbers on the page are the numbers the app would show.
 */
export const HOLIDAYS = [
  { date: '2026-11-08', name: 'Diwali', addedBy: 'Priya Nair' },
  { date: '2026-12-25', name: 'Christmas Day', addedBy: 'System' },
  { date: '2027-01-26', name: 'Republic Day', addedBy: 'System' },
  { date: '2027-08-15', name: 'Independence Day', addedBy: 'System' },
  { date: '2027-10-02', name: 'Gandhi Jayanti', addedBy: 'System' },
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const utc = (iso) => new Date(`${iso}T00:00:00Z`);

/** "Fri 1 Oct" (or "Fri 1 Oct 2027" with the year). */
export function dayLabel(iso, withYear = false) {
  const d = utc(iso);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}${withYear ? ` ${d.getUTCFullYear()}` : ''}`;
}

/** "1–6 Oct", or "28 Dec–2 Jan" across months. */
export function shortRange(from, to) {
  const a = utc(from);
  const b = utc(to);
  if (a.getUTCMonth() === b.getUTCMonth()) return `${a.getUTCDate()}–${b.getUTCDate()} ${MONTHS[b.getUTCMonth()]}`;
  return `${a.getUTCDate()} ${MONTHS[a.getUTCMonth()]}–${b.getUTCDate()} ${MONTHS[b.getUTCMonth()]}`;
}

/** A sample request: the dates plus what they cost in leave and, in words, what was left out. */
export function sampleLeave(name, from, to, extra = {}) {
  const b = leaveBreakdown(from, to, HOLIDAYS);
  return { name, from, to, days: b.days, calendarDays: b.calendarDays, note: excludedSummary(b), ...extra };
}

export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** The example used across the page: Fri 1 Oct to Wed 6 Oct 2027. Gandhi Jayanti is the Saturday, then a Sunday. */
export const ARJUN = sampleLeave('Arjun Sharma', '2027-10-01', '2027-10-06', { reason: 'Cousin’s wedding in Jaipur' });
/** A short one, for comparison: two days, nothing left out, nothing to attach. */
export const SHORT = sampleLeave('Sneha Kulkarni', '2026-11-23', '2026-11-24', { reason: 'Moving house' });

export const BOARD = {
  manager: [sampleLeave('Imran Khan', '2026-11-19', '2026-11-20')],
  hod: [sampleLeave('Rohan Das', '2026-12-14', '2026-12-21')],
  approved: [SHORT],
  info: [sampleLeave('Kavya Reddy', '2026-12-24', '2026-12-29'), sampleLeave('Meera Joshi', '2027-01-25', '2027-01-30')],
};
