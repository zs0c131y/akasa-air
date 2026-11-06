import { cn } from './lib/utils.js';

/** Small flat ink drawings with one orange accent. Decorative, so hidden from screen readers. */
const base = { viewBox: '0 0 160 120', fill: 'none', 'aria-hidden': true, focusable: 'false' };
const ink = { stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };

/** An empty in-tray with a paper plane resting on it. For lists with nothing in them. */
export function EmptyTray({ className }) {
  return (
    <svg {...base} className={cn('h-28 w-40 text-foreground', className)}>
      <path d="M26 74h108l-10 30H36L26 74Z" {...ink} />
      <path d="M26 74 40 52h80l14 22" {...ink} />
      <path d="M26 74h34a8 8 0 0 0 8 8h24a8 8 0 0 0 8-8h34" {...ink} />
      <path d="m96 22 34 14-34 14 6-14-6-14Z" fill="hsl(var(--flame))" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="m102 36 28 0" {...ink} />
      <path d="M70 30c-10 0-16 6-22 6" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 5" strokeLinecap="round" />
    </svg>
  );
}

/** A luggage tag with a question mark: for pages and requests that cannot be found. */
export function LostTag({ className }) {
  return (
    <svg {...base} className={cn('h-28 w-40 text-foreground', className)}>
      <path d="M80 8c-14 0-22 8-22 18v6" {...ink} />
      <path d="M80 8c14 0 22 8 22 18v6" {...ink} />
      <path d="M62 36h36l14 14v54a6 6 0 0 1-6 6H54a6 6 0 0 1-6-6V50l14-14Z" fill="hsl(var(--card))" {...ink} />
      <circle cx="80" cy="46" r="4" fill="hsl(var(--flame))" stroke="currentColor" strokeWidth="2" />
      <path d="M72 70c0-6 4-9 8-9s8 3 8 8c0 6-8 6-8 13" {...ink} />
      <circle cx="80" cy="95" r="1.6" fill="currentColor" />
    </svg>
  );
}

/** A closed gate barrier: for pages the signed-in person may not open. */
export function ClosedGate({ className }) {
  return (
    <svg {...base} className={cn('h-28 w-40 text-foreground', className)}>
      <path d="M30 104V40M130 104V40" {...ink} />
      <path d="M26 104h16M118 104h16" {...ink} />
      <rect x="30" y="52" width="100" height="16" fill="hsl(var(--card))" {...ink} />
      <path d="M44 52l16 16M72 52l16 16M100 52l16 16" stroke="hsl(var(--flame))" strokeWidth="6" />
      <rect x="30" y="52" width="100" height="16" {...ink} />
      <path d="M62 30h36" {...ink} />
    </svg>
  );
}

/** A broken connection: for being offline. */
export function Unplugged({ className }) {
  return (
    <svg {...base} className={cn('h-28 w-40 text-foreground', className)}>
      <path d="M20 80h28M112 80h28" {...ink} />
      <rect x="48" y="66" width="20" height="28" rx="4" fill="hsl(var(--card))" {...ink} />
      <rect x="92" y="66" width="20" height="28" rx="4" fill="hsl(var(--card))" {...ink} />
      <path d="M68 74h8M68 86h8M84 74h8M84 86h8" {...ink} />
      <path d="m76 50 8-12M70 42l-8-8M90 44l10-8" stroke="hsl(var(--flame))" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** Rubber-stamp style mark, used on decided requests. */
export function Stamp({ children, tone = 'green', className }) {
  const colour = { green: 'text-status-green-fg', red: 'text-status-red-fg', grey: 'text-status-grey-fg' }[tone];
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-block -rotate-6 rounded-sm border-2 border-current px-3 py-1 font-mono text-sm font-semibold uppercase tracking-[0.18em]',
        colour,
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ---------- People ----------
 * Flat vector faces, picked deterministically from a name so the same person always looks the same.
 * Hand-built parts (skin, hair, shirt, background) rather than initials in a circle, so lists feel like people.
 */
const SKIN = ['#F3D2B3', '#E3B58A', '#C58C5E', '#9A6240', '#6E4429'];
const HAIR = ['#1B1410', '#2E211A', '#5A3B26', '#8A5A33', '#C9A06A', '#3A3A3A'];
const SHIRT = ['#1F2A37', '#2F5D50', '#7A3B2E', '#35507A', '#4B3F72', '#8A6D1F', '#2B2B2B'];
const BG = ['#FFE3D2', '#DDEBD9', '#DCE8F7', '#EFE1F5', '#F6E8B8', '#E6E3DA'];
const MALE_STYLES = ['short', 'crop', 'curly', 'cap', 'bald'];
const FEMALE_STYLES = ['long', 'bun', 'bob', 'pony', 'wavy'];

/* Common first names, so a face matches the name it sits next to. Anything not listed gets a style picked from the name. */
const FEMALE_NAMES = new Set([
  'priya',
  'ananya',
  'kavya',
  'sneha',
  'meera',
  'asha',
  'nina',
  'divya',
  'pooja',
  'neha',
  'riya',
  'isha',
  'anjali',
  'deepa',
  'lakshmi',
  'shreya',
  'swati',
  'tanvi',
  'aditi',
  'sunita',
  'kriti',
  'nisha',
  'radha',
  'sara',
  'fatima',
  'zoya',
  'aisha',
  'anita',
  'rekha',
  'shweta',
  'preeti',
  'simran',
  'jyoti',
  'kiran',
  'maya',
  'sana',
  'ayesha',
  'mansi',
  'ritu',
  'tara',
]);
const MALE_NAMES = new Set([
  'rahul',
  'arjun',
  'rohan',
  'imran',
  'dev',
  'amit',
  'vikram',
  'rajesh',
  'suresh',
  'karan',
  'aman',
  'raj',
  'ravi',
  'sanjay',
  'manoj',
  'nikhil',
  'sachin',
  'ajay',
  'vijay',
  'rohit',
  'sameer',
  'farhan',
  'irfan',
  'omar',
  'yash',
  'harsh',
  'varun',
  'aditya',
  'siddharth',
  'kunal',
  'mohit',
  'gaurav',
  'ankit',
  'deepak',
  'pranav',
  'tarun',
  'naveen',
  'arun',
  'abhishek',
  'zaid',
]);

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function Person({ name = '', className, title }) {
  const h = hash(String(name).toLowerCase());
  const pick = (arr, shift) => arr[(h >>> shift) % arr.length];
  const skin = pick(SKIN, 0);
  const hair = pick(HAIR, 3);
  const shirt = pick(SHIRT, 6);
  const bg = pick(BG, 9);
  const first = String(name).trim().split(/\s+/)[0].toLowerCase();
  const female = FEMALE_NAMES.has(first) ? true : MALE_NAMES.has(first) ? false : (h >>> 20) % 2 === 0;
  const style = pick(female ? FEMALE_STYLES : MALE_STYLES, 12);
  const beard = !female && (h >>> 15) % 3 === 0 && style !== 'cap';
  return (
    <svg
      viewBox="0 0 64 64"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
      className={cn('size-10 shrink-0 rounded-full', className)}
    >
      <rect width="64" height="64" fill={bg} />
      {(style === 'long' || style === 'wavy') && <path d="M16 31c0-13 7-19 16-19s16 6 16 19v23H16V31Z" fill={hair} />}
      {style === 'pony' && <path d="M46 24c6 2 8 10 5 20-2 4-6 4-8 1 3-6 3-14 3-21Z" fill={hair} />}
      <path d="M8 64c1-11 9-17 24-17s23 6 24 17H8Z" fill={shirt} />
      {female && <path d="M26 48c2 5 10 5 12 0" fill="none" stroke={skin} strokeWidth="3" strokeLinecap="round" />}
      <rect x="27" y="38" width="10" height="11" rx="4" fill={skin} />
      <ellipse cx="32" cy="29" rx="11" ry="12.5" fill={skin} />
      {(style === 'short' || style === 'crop') && (
        <path d="M20.500 27c-1-9 5-14 11.500-14s12.500 5 11.500 14c-2-5-6-7-11.500-7s-9.500 2-11.500 7Z" fill={hair} />
      )}
      {style === 'long' && (
        <path d="M20.500 28c-1.500-9 4-15 11.500-15s13 6 11.500 15c-1-6-5-9-11.500-9S21.500 22 20.500 28Z" fill={hair} />
      )}
      {style === 'wavy' && <path d="M20 29c-2-10 4-16 12-16s14 6 12 16c-2-3-4-4-6-8-3 4-9 4-12 0-2 4-4 5-6 8Z" fill={hair} />}
      {style === 'bob' && <path d="M19 36c-3-14 3-23 13-23s16 9 13 23c-1-6-3-9-6-11-4 3-10 3-14 0-3 2-5 5-6 11Z" fill={hair} />}
      {style === 'pony' && <path d="M20.500 27c-1-9 5-14 11.500-14s12.500 5 11.500 14c-2-5-6-7-11.500-7s-9.500 2-11.500 7Z" fill={hair} />}
      {style === 'curly' && (
        <g fill={hair}>
          <circle cx="22" cy="21" r="6" />
          <circle cx="29" cy="16" r="6.500" />
          <circle cx="37" cy="16" r="6.500" />
          <circle cx="43" cy="21" r="6" />
          <circle cx="32" cy="19" r="7" />
        </g>
      )}
      {style === 'bun' && (
        <g fill={hair}>
          <circle cx="32" cy="9" r="5.500" />
          <path d="M20.500 27c-1-9 5-14 11.500-14s12.500 5 11.500 14c-2-5-6-7-11.500-7s-9.500 2-11.500 7Z" />
        </g>
      )}
      {style === 'cap' && (
        <g>
          <path d="M20 24c0-8 5-12 12-12s12 4 12 12H20Z" fill={shirt} />
          <rect x="18" y="23" width="28" height="3.500" rx="1.700" fill={shirt} />
        </g>
      )}
      {beard && <path d="M22 31c1 9 5 12 10 12s9-3 10-12c-3 4-6 5-10 5s-7-1-10-5Z" fill={hair} opacity=".9" />}
      <circle cx="27.500" cy="30" r="1.300" fill="#1B1410" />
      <circle cx="36.500" cy="30" r="1.300" fill="#1B1410" />
      <path d="M28.500 35c2 1.800 5 1.800 7 0" fill="none" stroke="#1B1410" strokeWidth="1.400" strokeLinecap="round" />
    </svg>
  );
}
