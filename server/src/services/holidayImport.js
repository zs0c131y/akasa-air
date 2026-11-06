import { parseISODate } from '@lms/shared';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const pad = (n) => String(n).padStart(2, '0');

/**
 * Reads the date formats people actually paste in: 2026-10-02, 02/10/2026, 2-10-2026, 02.10.2026, 2 Oct 2026, 02-Oct-2026.
 * Day first for numeric dates (the Indian convention). Returns 'YYYY-MM-DD' or null.
 */
export function normalizeDate(input) {
  const s = String(input ?? '').trim();
  let y;
  let m;
  let d;
  let hit = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (hit) [, y, m, d] = hit;
  else if ((hit = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s))) [, d, m, y] = hit;
  else if ((hit = /^(\d{1,2})[\s/.-]+([A-Za-z]{3,9})[\s/.,-]+(\d{4})$/.exec(s))) {
    const idx = MONTHS.indexOf(hit[2].slice(0, 3).toLowerCase());
    if (idx < 0) return null;
    [, d, , y] = hit;
    m = idx + 1;
  } else return null;
  const iso = `${y}-${pad(Number(m))}-${pad(Number(d))}`;
  return parseISODate(iso) === null ? null : iso;
}

/** Splits CSV / TSV / semicolon text into rows of cells. Handles "quoted, fields" and "" escapes. */
export function parseDelimited(text) {
  const src = String(text ?? '').replace(/^﻿/, '');
  const firstLine = src.split(/\r?\n/).find((l) => l.trim()) ?? '';
  const delim = [',', '\t', ';'].map((c) => [c, firstLine.split(c).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  let line = 1;
  let rowLine = 1;
  const endCell = () => { row.push(cell.trim()); cell = ''; };
  const endRow = () => {
    endCell();
    if (row.some((c) => c !== '')) rows.push({ line: rowLine, cells: row });
    row = [];
  };
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i += 1; } else if (ch === '"') quoted = false;
      else { cell += ch; if (ch === '\n') line += 1; }
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === delim) endCell();
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i += 1;
      endRow();
      line += 1;
      rowLine = line;
    } else cell += ch;
  }
  endRow();
  return rows;
}

const NAME_HEADERS = ['name', 'holiday', 'occasion', 'description', 'title'];
const PLACE_HEADERS = ['location', 'base', 'city', 'state', 'office', 'applies to'];

/**
 * Turns pasted text into { line, date, name, location } rows (still raw: nothing is validated against the calendar yet).
 * A header row is optional; if present, columns are found by name, otherwise the order is date, name, location.
 */
export function parseHolidayRows(text) {
  const rows = parseDelimited(text);
  if (rows.length === 0) return [];
  let dateCol = 0;
  let nameCol = 1;
  let placeCol = 2;
  let start = 0;
  const looksLikeHeader = !rows[0].cells.some((c) => normalizeDate(c));
  if (looksLikeHeader) {
    const head = rows[0].cells.map((c) => c.toLowerCase());
    const find = (names, fallback) => { const i = head.findIndex((h) => names.includes(h)); return i >= 0 ? i : fallback; };
    dateCol = find(['date', 'day'], 0);
    nameCol = find(NAME_HEADERS, 1);
    placeCol = find(PLACE_HEADERS, 2);
    start = 1;
  }
  return rows.slice(start).map(({ line, cells }) => ({ line, date: cells[dateCol] ?? '', name: cells[nameCol] ?? '', location: cells[placeCol] ?? '' }));
}
