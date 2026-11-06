import { describe, it, expect } from 'vitest';
import {
  countLeaveDays,
  isLongLeave,
  documentRequirementError,
  emergencyBlockMessage,
  leaveInputSchema,
  todayISO,
  parseISODate,
  leaveBreakdown,
  excludedSummary,
  documentsAccepted,
  makeLeaveInputSchema,
  consecutiveChain,
  absenceDays,
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
  it('a Sunday inside leave still counts as being away, so Friday to Monday is long', () => {
    expect(countLeaveDays('2026-11-06', '2026-11-09')).toBe(3); // Fri, Sat, (Sun), Mon are charged as 3
    expect(absenceDays('2026-11-06', '2026-11-09')).toBe(4); // but four days in a row away
    expect(isLongLeave(absenceDays('2026-11-06', '2026-11-09'))).toBe(true);
  });
});

describe('schema: Sunday-only request', () => {
  it('is rejected with a friendly message', () => {
    const d = (() => { let t = parseISODate(todayISO()) + 86400000; while (new Date(t).getUTCDay() !== 0) t += 86400000; return new Date(t).toISOString().slice(0, 10); })();
    const r = leaveInputSchema.safeParse({ fromDate: d, toDate: d, reason: 'Resting day' });
    expect(r.success).toBe(false);
    expect(r.error.issues[0].message).toMatch(/Sundays and public holidays are not counted/);
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

describe('public holidays are not counted', () => {
  const hol = [{ date: '2026-11-04', name: 'Diwali' }];
  it('skips a holiday inside the range', () => expect(countLeaveDays('2026-11-02', '2026-11-06', hol)).toBe(4));
  it('accepts plain date strings too', () => expect(countLeaveDays('2026-11-02', '2026-11-06', ['2026-11-04'])).toBe(4));
  it('skips Sundays and holidays together', () => expect(countLeaveDays('2026-11-02', '2026-11-09', hol)).toBe(6));
  it('reports what was left out', () => {
    const b = leaveBreakdown('2026-11-02', '2026-11-09', hol);
    expect(b).toMatchObject({ days: 6, calendarDays: 8, sundays: 1, holidays: [{ date: '2026-11-04', name: 'Diwali' }] });
    expect(excludedSummary(b)).toBe('1 Sunday and Diwali are not counted');
  });
  it('a holiday on a Sunday is only a Sunday', () => {
    const b = leaveBreakdown('2026-11-08', '2026-11-09', [{ date: '2026-11-08', name: 'Diwali' }]);
    expect(b).toMatchObject({ days: 1, sundays: 1, holidays: [] });
  });
  it('a request made only of holidays and Sundays is refused', () => {
    const schema = makeLeaveInputSchema([{ date: plus(1), name: 'Founders Day' }]);
    const r = schema.safeParse({ fromDate: plus(1), toDate: plus(1), reason: 'Long weekend' });
    expect(r.success).toBe(false);
  });
  it('documents are only for leave over 3 days', () => {
    expect(documentsAccepted(3)).toBe(false);
    expect(documentsAccepted(4)).toBe(true);
  });
});

describe('leave in a row', () => {
  // Mon 2 Nov 2026 .. Fri 6 Nov; Sunday 8 Nov; Mon 9 Nov..
  const early = { fromDate: '2026-11-02', toDate: '2026-11-03', days: 2 };
  it('two short requests that touch add up', () => {
    const c = consecutiveChain('2026-11-04', '2026-11-05', [early]);
    expect(c.chainDays).toBe(4);
    expect(c.members).toHaveLength(1);
  });
  it('a Sunday between two requests does not break the stretch', () => {
    const sat = { fromDate: '2026-11-07', toDate: '2026-11-07', days: 1 };
    expect(consecutiveChain('2026-11-09', '2026-11-10', [sat]).chainDays).toBe(3); // Sat, (Sun), Mon, Tue
  });
  it('a holiday between two requests does not break it either', () => {
    const tue = { fromDate: '2026-11-03', toDate: '2026-11-03', days: 1 };
    const hol = [{ date: '2026-11-04', name: 'Local Day' }];
    expect(consecutiveChain('2026-11-05', '2026-11-05', [tue], hol).chainDays).toBe(2);
  });
  it('a working day in between does break it', () => {
    expect(consecutiveChain('2026-11-05', '2026-11-06', [early]).chainDays).toBe(2); // Wed 4 Nov is a gap
    expect(consecutiveChain('2026-11-05', '2026-11-06', [early]).members).toHaveLength(0);
  });
  it('follows a chain of several requests in both directions', () => {
    const a = { fromDate: '2026-11-02', toDate: '2026-11-02', days: 1 };
    const c = { fromDate: '2026-11-04', toDate: '2026-11-04', days: 1 };
    const out = consecutiveChain('2026-11-03', '2026-11-03', [c, a]);
    expect(out.chainDays).toBe(3);
    expect(out.from).toBe('2026-11-02');
    expect(out.to).toBe('2026-11-04');
  });
  it('is just the request itself when there is nothing else', () => {
    expect(consecutiveChain('2026-11-02', '2026-11-04', []).chainDays).toBe(3);
  });
});

describe('days in a row (absenceDays)', () => {
  it('counts calendar days first to last, both included', () => {
    expect(absenceDays('2026-11-02', '2026-11-02')).toBe(1);
    expect(absenceDays('2026-11-02', '2026-11-04')).toBe(3);
    expect(absenceDays('2026-11-02', '2026-11-05')).toBe(4);
  });
  it('is 0 for reversed or invalid dates', () => {
    expect(absenceDays('2026-11-05', '2026-11-02')).toBe(0);
    expect(absenceDays('x', '2026-11-02')).toBe(0);
  });
  it('catches Friday and Saturday, then Monday to Wednesday', () => {
    const first = { fromDate: '2026-11-06', toDate: '2026-11-07', days: 2 };
    const c = consecutiveChain('2026-11-09', '2026-11-11', [first]);
    expect(c.chainDays).toBe(5);
    expect(c.absenceDays).toBe(6);
    expect(isLongLeave(c.absenceDays)).toBe(true);
  });
});
