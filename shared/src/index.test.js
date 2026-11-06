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

describe('countLeaveDays', () => {
  it('counts a single day as 1', () => expect(countLeaveDays('2026-11-01', '2026-11-01')).toBe(1));
  it('is inclusive', () => expect(countLeaveDays('2026-11-01', '2026-11-05')).toBe(5));
  it('spans month and leap boundaries', () => {
    expect(countLeaveDays('2028-02-28', '2028-03-01')).toBe(3);
    expect(countLeaveDays('2026-12-30', '2027-01-02')).toBe(4);
  });
  it('returns 0 for reversed or invalid', () => {
    expect(countLeaveDays('2026-11-05', '2026-11-01')).toBe(0);
    expect(countLeaveDays('2026-02-30', '2026-03-01')).toBe(0);
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
    expect(leaveInputSchema.safeParse({ ...ok, fromDate: plus(-60), toDate: plus(-59) }).success).toBe(false);
    expect(leaveInputSchema.safeParse({ ...ok, fromDate: plus(400), toDate: plus(401) }).success).toBe(false);
  });
});
