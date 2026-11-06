import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { CalendarDays, Check, Paperclip } from 'lucide-react';
import { LONG_LEAVE_THRESHOLD_DAYS, MAX_FILES } from '@lms/shared';
import { ACTION_LABELS, Avatar, StatusChip } from '../components.jsx';
import { Badge } from '../ui/badge.jsx';
import { cn } from '../lib/utils.js';
import { ARJUN, HOLIDAYS, SHORT, dayLabel, plural, shortRange } from './sample.js';

const Globe = lazy(() => import('../Globe.jsx'));

/**
 * A dark, rounded frame for a piece of mock UI. The mock itself is hidden from screen readers (its buttons are
 * pictures of buttons); `summary` says in words what it shows.
 */
export function Panel({ summary, className, children }) {
  return (
    <figure className="dark m-0">
      <div className={cn('relative overflow-hidden rounded-2xl border border-border bg-background p-3 text-foreground shadow-lift sm:p-5', className)}>
        <div aria-hidden="true">{children}</div>
      </div>
      <figcaption className="sr-only">{summary}</figcaption>
    </figure>
  );
}

const Window = ({ title, aside, className, children }) => (
  <div className={cn('rounded-lg border border-border bg-card', className)}>
    <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
      <p className="text-sm font-semibold">{title}</p>
      {aside}
    </div>
    <div className="p-4">{children}</div>
  </div>
);

const FakeField = ({ label, value }) => (
  <div className="min-w-0">
    <p className="mb-1 text-[0.72rem] font-medium text-muted-foreground">{label}</p>
    <p className="flex h-9 items-center justify-between gap-2 rounded-md border border-input bg-card px-2.5 text-[0.8rem]">
      <span className="truncate">{value}</span>
      <CalendarDays className="size-3.5 shrink-0 text-muted-foreground" />
    </p>
  </div>
);

const FakeButton = ({ tone = 'outline', children }) => (
  <span
    className={cn(
      'inline-flex h-8 items-center rounded-md px-3 text-[0.75rem] font-medium',
      tone === 'brand' && 'bg-brand text-brand-foreground',
      tone === 'success' && 'bg-status-green-fg text-background',
      tone === 'outline' && 'border border-input text-foreground',
    )}
  >
    {children}
  </span>
);

function CountLine({ leave }) {
  return (
    <p className="border-l-4 border-flame bg-secondary px-3 py-2 text-[0.8rem]">
      <strong className="num">{plural(leave.days, 'leave day')}</strong>
      <span className="text-muted-foreground"> · {leave.note || 'Sundays and public holidays are never counted'}</span>
    </p>
  );
}

/** 1. The apply form: a short request with nothing to attach, and a long one where the upload box appears. */
export function ApplyPanel() {
  return (
    <Panel
      summary={`Two example requests. ${dayLabel(SHORT.from)} to ${dayLabel(SHORT.to)} counts as ${plural(SHORT.days, 'day')} and shows no upload box. ${dayLabel(ARJUN.from)} to ${dayLabel(ARJUN.to)} counts as ${plural(ARJUN.days, 'day')}, ${ARJUN.note}, and asks for a supporting document.`}
    >
      <div className="space-y-3">
        <Window title="Apply for leave" aside={<span className="kicker">{plural(SHORT.days, 'day')}</span>}>
          <div className="grid grid-cols-2 gap-3">
            <FakeField label="From" value={dayLabel(SHORT.from, true)} />
            <FakeField label="To" value={dayLabel(SHORT.to, true)} />
          </div>
          <div className="mt-3"><CountLine leave={SHORT} /></div>
          <p className="mt-3 text-[0.78rem] text-muted-foreground">Up to {LONG_LEAVE_THRESHOLD_DAYS} days needs no second approval and no documents.</p>
        </Window>

        <Window title="Apply for leave" aside={<Badge variant="blue">Long leave</Badge>} className="ring-1 ring-flame/60">
          <div className="grid grid-cols-2 gap-3">
            <FakeField label="From" value={dayLabel(ARJUN.from, true)} />
            <FakeField label="To" value={dayLabel(ARJUN.to, true)} />
          </div>
          <div className="mt-3"><CountLine leave={ARJUN} /></div>
          <p className="mb-1 mt-4 text-[0.72rem] font-medium text-muted-foreground">Supporting documents (required)</p>
          <div className="rounded-md border border-dashed border-input p-3">
            <p className="flex items-center gap-2 text-[0.8rem]">
              <Paperclip className="size-3.5 shrink-0 text-brand" />
              <span className="truncate font-medium">wedding-invitation.pdf</span>
              <span className="ml-auto shrink-0 font-mono text-[0.66rem] text-muted-foreground">212 KB</span>
            </p>
            <p className="mt-2 text-[0.72rem] text-muted-foreground">PDF, JPG or PNG, up to 5 MB each, at most {MAX_FILES} files.</p>
          </div>
          <div className="mt-4 flex justify-end"><FakeButton tone="brand">Submit request</FakeButton></div>
        </Window>
      </div>
    </Panel>
  );
}

const THREAD = [
  ['SUBMITTED', 'Arjun Sharma', ARJUN.reason, '28 Sep, 09:14'],
  ['REQUEST_INFO', 'Rahul Mehta', 'Who is covering your shifts on the 4th and 5th?', '28 Sep, 11:02'],
  ['REPLY', 'Arjun Sharma', 'Neha has swapped with me for both days.', '28 Sep, 11:40'],
  ['APPROVE', 'Rahul Mehta', 'Fine by me. Enjoy the wedding.', '28 Sep, 12:05'],
];

/** 2. The approval path: manager, then HOD, with the conversation on the request. */
export function ApprovalPanel() {
  return (
    <Panel summary={`Arjun Sharma's request for ${plural(ARJUN.days, 'day')}. Rahul, his manager, asked who covers his shifts, Arjun replied, and Rahul approved. It is now waiting for Priya, the head of department, who can approve, reject or ask for more information.`}>
      <Window title="Leave request" aside={<StatusChip status="PENDING_HOD" className="px-1.5 py-0.5 text-[0.7rem]" />}>
        <div className="flex items-center gap-3">
          <Avatar name="Arjun Sharma" className="size-10" />
          <div className="min-w-0">
            <p className="font-semibold leading-tight">Arjun Sharma</p>
            <p className="font-mono text-[0.68rem] uppercase tracking-[0.06em] text-muted-foreground">{shortRange(ARJUN.from, ARJUN.to)} 2027 · {plural(ARJUN.days, 'day')}</p>
          </div>
        </div>

        <ol className="mt-4 grid grid-cols-2 gap-2 text-[0.75rem]">
          <li className="rounded-md border border-status-green-fg/40 bg-status-green-bg px-3 py-2 text-status-green-fg">
            <span className="kicker block text-current">1 · Manager</span>
            <span className="mt-0.5 flex items-center gap-1 font-semibold"><Check className="size-3.5" strokeWidth={2.6} /> Rahul approved</span>
          </li>
          <li className="rounded-md border border-status-blue-fg/40 bg-status-blue-bg px-3 py-2 text-status-blue-fg">
            <span className="kicker block text-current">2 · HOD</span>
            <span className="mt-0.5 block font-semibold">With Priya now</span>
          </li>
        </ol>

        <ul className="mt-4 space-y-3 border-l border-rule pl-4">
          {THREAD.map(([action, who, text, at]) => (
            <li key={action} className="relative">
              <span className={cn('absolute -left-[1.3rem] top-1.5 size-2 rounded-full', action === 'APPROVE' ? 'bg-status-green-fg' : action === 'REQUEST_INFO' ? 'bg-status-purple-fg' : 'bg-rule')} />
              <p className="flex flex-wrap items-baseline gap-x-2 text-[0.78rem]">
                <span className="font-semibold">{ACTION_LABELS[action]}</span>
                <span className="text-muted-foreground">{who}</span>
                <span className="ml-auto font-mono text-[0.64rem] text-muted-foreground">{at}</span>
              </p>
              <p className="mt-0.5 text-[0.8rem]">&ldquo;{text}&rdquo;</p>
            </li>
          ))}
        </ul>

        <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
          <FakeButton tone="success">Approve</FakeButton>
          <FakeButton>Reject</FakeButton>
          <FakeButton>Ask for more information</FakeButton>
        </div>
      </Window>
    </Panel>
  );
}

const AUDIT = [
  ['holiday added', 'neutral', 'Priya Nair', 'HOD', null, `Diwali, ${dayLabel('2026-11-08', true)}`, '2 Nov, 16:20'],
  ['approve', 'green', 'Rahul Mehta', 'MANAGER', 'Arjun Sharma', 'Status: PENDING_MANAGER → PENDING_HOD', '28 Sep, 12:05'],
  ['document viewed', 'neutral', 'Priya Nair', 'HOD', 'Arjun Sharma', 'wedding-invitation.pdf', '28 Sep, 14:31'],
];

/** 3. The holiday calendar the HOD keeps, beside the audit log that records changes to it. */
export function CalendarPanel() {
  return (
    <Panel summary="The holiday calendar, with Diwali added by Priya Nair and the fixed national holidays added by the system, and the audit log showing that addition, an approval and a document being opened.">
      <div className="grid gap-3 sm:grid-cols-2">
        <Window title="Holidays" aside={<span className="kicker">HOD only edits</span>}>
          <ul className="divide-y divide-border">
            {HOLIDAYS.map((h) => (
              <li key={h.date} className="flex items-baseline justify-between gap-3 py-2 first:pt-0 last:pb-0">
                <span className="min-w-0">
                  <span className="block truncate text-[0.82rem] font-semibold">{h.name}</span>
                  <span className="block text-[0.7rem] text-muted-foreground">Added by {h.addedBy}</span>
                </span>
                <span className="shrink-0 font-mono text-[0.66rem] text-muted-foreground">{dayLabel(h.date, true)}</span>
              </li>
            ))}
          </ul>
        </Window>
        <Window title="Audit log" aside={<span className="kicker">Read only</span>}>
          <ul className="space-y-3">
            {AUDIT.map(([action, tone, who, role, on, detail, at]) => (
              <li key={action} className="text-[0.78rem]">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant={tone} className="rounded-sm font-mono text-[0.6rem] uppercase tracking-[0.1em]">{action}</Badge>
                  <span className="font-mono text-[0.62rem] text-muted-foreground">{at}</span>
                </div>
                <p className="mt-1">
                  <strong className="font-semibold">{who}</strong> <span className="text-muted-foreground">({role})</span>
                  {on && <> on <strong className="font-semibold">{on}</strong>&rsquo;s request</>}
                </p>
                <p className="break-words text-[0.72rem] text-muted-foreground">{detail}</p>
              </li>
            ))}
          </ul>
        </Window>
      </div>
    </Panel>
  );
}

/** Loads the globe only on wide screens, and only once the panel is close to the viewport. */
function useGlobeWanted(ref) {
  const [wanted, setWanted] = useState(false);
  useEffect(() => {
    const el = ref.current;
    const wide = window.matchMedia?.('(min-width: 1024px)');
    if (!el || !wide || typeof IntersectionObserver === 'undefined') return undefined;
    let near = false;
    const update = () => setWanted(near && wide.matches);
    const io = new IntersectionObserver(([e]) => { near = near || e.isIntersecting; update(); }, { rootMargin: '400px 0px' });
    io.observe(el);
    wide.addEventListener('change', update);
    return () => { io.disconnect(); wide.removeEventListener('change', update); };
  }, [ref]);
  return wanted;
}

/** 4. One holiday calendar and one set of rules for people in many places. The globe is decoration. */
export function NetworkPanel() {
  const ref = useRef(null);
  const showGlobe = useGlobeWanted(ref);
  const next = HOLIDAYS.find((h) => h.name === 'Christmas Day');
  return (
    <Panel summary="A globe facing India, for illustration only, with a note that one holiday calendar applies to everyone." className="p-0 sm:p-0">
      <div ref={ref} className="gridlines relative h-[19rem] sm:h-[24rem] lg:h-[28rem]">
        {showGlobe && (
          <Suspense fallback={null}>
            <Globe className="absolute inset-0" />
          </Suspense>
        )}
        <p className="kicker absolute left-4 top-4 sm:left-5 sm:top-5">For illustration, not a route map</p>
        <div className="absolute bottom-4 left-4 right-4 max-w-[17rem] rounded-lg border border-border bg-card p-4 sm:bottom-5 sm:left-5">
          <p className="kicker">Holiday calendar</p>
          <p className="mt-2 flex items-center gap-2 text-sm font-semibold">
            <CalendarDays className="size-4 shrink-0 text-brand" />
            {next.name}, {dayLabel(next.date)}
          </p>
          <p className="mt-1 text-[0.78rem] text-muted-foreground">Applies to everyone, wherever they are based.</p>
        </div>
      </div>
    </Panel>
  );
}
