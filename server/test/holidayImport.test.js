import { describe, it, expect } from 'vitest';
import { normalizeDate, parseDelimited, parseHolidayRows } from '../src/services/holidayImport.js';

describe('normalizeDate', () => {
  it.each([
    ['2026-10-02', '2026-10-02'],
    ['02/10/2026', '2026-10-02'],
    ['2-10-2026', '2026-10-02'],
    ['02.10.2026', '2026-10-02'],
    ['2 Oct 2026', '2026-10-02'],
    ['02-Oct-2026', '2026-10-02'],
    ['15 August 2027', '2027-08-15'],
  ])('reads %s', (input, iso) => expect(normalizeDate(input)).toBe(iso));

  it('reads numeric dates day first', () => expect(normalizeDate('03/04/2026')).toBe('2026-04-03'));
  it.each(['', 'soon', '31/02/2026', '2026-13-01', '10/2026', '2 Foo 2026'])('rejects "%s"', (input) => expect(normalizeDate(input)).toBeNull());
});

describe('parseDelimited', () => {
  it('handles commas, tabs and semicolons', () => {
    expect(parseDelimited('a,b\n1,2').map((r) => r.cells)).toEqual([['a', 'b'], ['1', '2']]);
    expect(parseDelimited('a\tb\n1\t2').map((r) => r.cells)).toEqual([['a', 'b'], ['1', '2']]);
    expect(parseDelimited('a;b\n1;2').map((r) => r.cells)).toEqual([['a', 'b'], ['1', '2']]);
  });
  it('keeps quoted commas and escaped quotes', () => {
    expect(parseDelimited('"Diwali, day 1","say ""hi"""')[0].cells).toEqual(['Diwali, day 1', 'say "hi"']);
  });
  it('copes with Windows line endings, a BOM and blank lines', () => {
    const rows = parseDelimited('﻿a,b\r\n\r\n1,2\r\n');
    expect(rows.map((r) => r.cells)).toEqual([['a', 'b'], ['1', '2']]);
  });
});

describe('parseHolidayRows', () => {
  it('works without a header, in the order date, name, location', () => {
    expect(parseHolidayRows('02/10/2026,Gandhi Jayanti,\n01/11/2026,Kannada Rajyotsava,Bengaluru')).toEqual([
      { line: 1, date: '02/10/2026', name: 'Gandhi Jayanti', location: '' },
      { line: 2, date: '01/11/2026', name: 'Kannada Rajyotsava', location: 'Bengaluru' },
    ]);
  });
  it('finds columns by header name in any order', () => {
    const rows = parseHolidayRows('Holiday,Base,Date\nDiwali,All,2026-11-08');
    expect(rows).toEqual([{ line: 2, date: '2026-11-08', name: 'Diwali', location: 'All' }]);
  });
  it('returns nothing for empty text', () => expect(parseHolidayRows('  \n ')).toEqual([]));
});
