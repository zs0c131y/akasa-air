import { describe, it, expect } from 'vitest';
import {
  countLeaveDays,
  isLongLeave,
  documentRequirementError,
  emergencyBlockMessage,
  leaveInputSchema,
  todayISO,
  parseISODate,
} from './index.js';

const plus = (n) => new Date(parseISODate(todayISO()) + n * 86400000).toISOString().slice(0, 10);

describe('countLeaveDays (Sundays are not counted)', () => {
  // 2026-11-02 is a Monday, 2026-11-01 and 2026-11-08 are Sundays.
  it('counts a single weekday as 1', () => expect(countLeaveDays('2026-11-02', '2026-11-02')).toBe(1));
  it('is inclusive', () => expect(countLeaveDays('2026-11-02', '2026-11-06')).toBe(5));
  it('skips a Sunday inside the range', () => expect(countLeaveDays('2026-11-06', '2026-11-10')).toBe(4)); // Fri-Tue, Sunday skipped
  it('counts Saturday', () => expect(countLeaveDays('2026-11-07', '2026-11-07')).toBe(1));
  it('is 0 when only Sundays are selected', () => expect(countLeaveDays('2026-11-01', '2026-11-01')).toBe(0));
  it('a Mon-to-Mon week is 7 days, not 8', () => expect(countLeaveDays('2026-11-02', '2026-11-09')).toBe(7));
  it('spans month and leap boundaries', () => {
    expect(countLeaveDays('2028-02-28', '2028-03-01')).toBe(3); // Mon-Wed
    expect(countLeaveDays('2026-12-30', '2027-01-02')).toBe(4); // Wed-Sat
  });
  it('returns 0 for reversed or invalid', () => {
    expect(countLeaveDays('2026-11-05', '2026-11-01')).toBe(0);
    expect(countLeaveDays('2026-02-30', '2026-03-01')).toBe(0);
  });
  it('a Sunday can make a 4-calendar-day request short', () => {
    expect(isLongLeave(countLeaveDays('2026-11-06', '2026-11-09'))).toBe(false); // Fri,Sat,(Sun),Mon = 3
  });
});

describe('schema: Sunday-only request', () => {
  it('is rejected with a friendly message', () => {
    const d = (() => { let t = parseISODate(todayISO()) + 86400000; while (new Date(t).getUTCDay() !== 0) t += 86400000; return new Date(t).toISOString().slice(0, 10); })();
    const r = leaveInputSchema.safeParse({ fromDate: d, toDate: d, reason: 'Resting day' });
    expect(r.success).toBe(false);
    expect(r.error.issues[0].message).toMatch(/Sundays are not counted/);
  });
});

describe('long leave rule', () => {
  it('3 days is not long, 4 days is', () => {
    expect(isLongLeave(3)).toBe(false);
    expect(isLongLeave(4)).toBe(true);
  });
  it('requires a document only above 3 days', () => {
    expect(documentRequirementError(3, 0)).toBeNull();
    expect(documentRequirementError(4, 0)).toMatch(/supporting document/);
    expect(documentRequirementError(4, 1)).toBeNull();
  });
});

describe('emergency leave', () => {
  it('waives the document requirement', () => expect(documentRequirementError(6, 0, true)).toBeNull());
  it('0 owed: anything; 1 owed: emergency only; 2 owed: nothing', () => {
    expect(emergencyBlockMessage(0, false)).toBeNull();
    expect(emergencyBlockMessage(1, true)).toBeNull();
    expect(emergencyBlockMessage(1, false)).toMatch(/upload them/);
    expect(emergencyBlockMessage(2, true)).toMatch(/any kind/);
  });
});

describe('leaveInputSchema', () => {
  const ok = { fromDate: plus(5), toDate: plus(6), reason: 'Family function' };
  it('accepts valid input', () => expect(leaveInputSchema.safeParse(ok).success).toBe(true));
  it('rejects end before start', () => {
    const r = leaveInputSchema.safeParse({ ...ok, toDate: plus(4) });
    expect(r.error.issues[0].path).toEqual(['toDate']);
  });
  it('rejects bad dates, short reason, far past/future', () => {
    expect(leaveInputSchema.safeParse({ ...ok, fromDate: 'nope' }).success).toBe(false);
    expect(leaveInputSchema.safeParse({ ...ok, reason: 'hi' }).success).toBe(false);
    expect(leaveInputSchema.safeParse({ ...ok, fromDate: plus(-1), toDate: plus(2) }).success).toBe(false);
    expect(leaveInputSchema.safeParse({ ...ok, fromDate: plus(0), toDate: plus(2) }).success).toBe(true);
    expect(leaveInputSchema.safeParse({ ...ok, fromDate: plus(400), toDate: plus(401) }).success).toBe(false);
  });
});
