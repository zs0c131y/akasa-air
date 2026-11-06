import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { parseISODate, todayISO } from '@lms/shared';
import { api } from '../api.js';
import { Avatar, ErrorBox, PageHeader, Panel, StatusChip, fmtDate } from '../components.jsx';
import { Button } from '../ui/button.jsx';
import { Skeleton } from '../ui/skeleton.jsx';
import { cn } from '../lib/utils.js';

const DAY = 86400000;
const iso = (t) => new Date(t).toISOString().slice(0, 10);
const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** The grid for a month: starts on the Monday on or before the 1st, ends on the Sunday on or after the last day. */
function gridFor(year, month) {
  const first = Date.UTC(year, month, 1);
  const last = Date.UTC(year, month + 1, 0);
  const lead = (new Date(first).getUTCDay() + 6) % 7;
  const tail = 6 - ((new Date(last).getUTCDay() + 6) % 7);
  const start = first - lead * DAY;
  const end = last + tail * DAY;
  const days = [];
  for (let t = start; t <= end; t += DAY) days.push(iso(t));
  return { days, from: iso(start), to: iso(end) };
}

export default function CalendarPage() {
  const today = todayISO();
  const [cursor, setCursor] = useState(() => ({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 }));
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [picked, setPicked] = useState(today);

  const grid = useMemo(() => gridFor(cursor.y, cursor.m), [cursor]);
  useEffect(() => {
    setData(null);
    setError(null);
    api.calendar(grid.from, grid.to).then(setData).catch(setError);
  }, [grid.from, grid.to]);

  const step = (n) =>
    setCursor(({ y, m }) => {
      const d = new Date(Date.UTC(y, m + n, 1));
      return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
    });
  const monthName = new Date(Date.UTC(cursor.y, cursor.m, 1)).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  const awayOn = (day) => (data?.items ?? []).filter((i) => i.fromDate <= day && i.toDate >= day);
  const holidaysOn = (day) => (data?.holidays ?? []).filter((h) => h.date === day);
  const dayList = picked ? awayOn(picked) : [];
  const pickedHolidays = picked ? holidaysOn(picked) : [];
  const pickedIsSunday = picked && new Date(parseISODate(picked)).getUTCDay() === 0;

  return (
    <section>
      <PageHeader
        kicker="Who is away"
        title="Team calendar"
        description="Approved leave and requests still waiting, with Sundays and public holidays marked. Those days are not counted as leave."
      >
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" aria-label="Previous month" onClick={() => step(-1)}>
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setCursor({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 });
              setPicked(today);
            }}
          >
            Today
          </Button>
          <Button variant="outline" size="icon" aria-label="Next month" onClick={() => step(1)}>
            <ChevronRight />
          </Button>
        </div>
      </PageHeader>

      <ErrorBox error={error} className="mb-4" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
        <div className="overflow-hidden rounded-lg border bg-card shadow-soft">
          <h2 className="border-b px-4 py-3 font-display text-lg" aria-live="polite">
            {monthName}
          </h2>
          <div className="grid grid-cols-7 border-b bg-secondary/60" aria-hidden="true">
            {WEEK.map((w) => (
              <div key={w} className="px-2 py-2 text-center font-mono text-[0.68rem] uppercase tracking-[0.12em] text-muted-foreground">
                {w}
              </div>
            ))}
          </div>
          {!data && !error && <Skeleton className="m-4 h-96 rounded-lg" />}
          {data && (
            <ul className="grid grid-cols-7" aria-label={`Days of ${monthName}`}>
              {grid.days.map((day, idx) => {
                const inMonth = Number(day.slice(5, 7)) - 1 === cursor.m;
                const sunday = idx % 7 === 6;
                const hol = holidaysOn(day);
                const away = awayOn(day);
                const isPicked = picked === day;
                return (
                  <li
                    key={day}
                    className={cn('border-b border-r last:border-r-0 [&:nth-child(7n)]:border-r-0', !inMonth && 'bg-secondary/40')}
                  >
                    <button
                      type="button"
                      onClick={() => setPicked(day)}
                      aria-pressed={isPicked}
                      aria-label={`${fmtDate(day)}${sunday ? ', Sunday' : ''}${hol.length ? `, ${hol.map((h) => h.name).join(', ')}` : ''}, ${away.length} away`}
                      className={cn(
                        'flex min-h-[4.5rem] w-full flex-col items-stretch gap-1 p-1.5 text-left transition-colors hover:bg-accent/60 sm:min-h-[6.5rem] sm:p-2',
                        isPicked && 'bg-accent',
                        (sunday || hol.length > 0) && inMonth && 'bg-status-amber-bg/40',
                      )}
                    >
                      <span
                        className={cn(
                          'num flex size-6 items-center justify-center self-start rounded-full text-xs font-semibold',
                          day === today && 'bg-flame text-flame-foreground',
                          !inMonth && 'text-muted-foreground',
                        )}
                      >
                        {Number(day.slice(8))}
                      </span>
                      {hol.length > 0 && (
                        <span className="hidden truncate rounded-sm bg-status-amber-bg px-1 text-[0.68rem] font-semibold text-status-amber-fg sm:block">
                          {hol[0].name}
                        </span>
                      )}
                      <span className="flex flex-wrap items-center gap-0.5">
                        {away.slice(0, 3).map((a) => (
                          <span
                            key={a.id}
                            className={cn('rounded-full', a.status !== 'APPROVED' && 'opacity-55 ring-1 ring-dashed ring-foreground/40')}
                          >
                            <Avatar name={a.employeeName} className="size-5 sm:size-6" />
                          </span>
                        ))}
                        {away.length > 3 && <span className="font-mono text-[0.65rem] text-muted-foreground">+{away.length - 3}</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <aside className="space-y-4 xl:sticky xl:top-36">
          <Panel
            title={picked ? fmtDate(picked) : 'Pick a day'}
            kicker={picked ? new Date(parseISODate(picked)).toLocaleDateString(undefined, { weekday: 'long', timeZone: 'UTC' }) : undefined}
          >
            {pickedIsSunday && <p className="mb-3 text-sm text-muted-foreground">Sunday. Not counted as leave.</p>}
            {pickedHolidays.map((h) => (
              <p key={h.id} className="mb-3 rounded-md bg-status-amber-bg px-3 py-2 text-sm font-semibold text-status-amber-fg">
                {h.name}
                {h.location ? ` (${h.location})` : ''}. Not counted as leave.
              </p>
            ))}
            {dayList.length === 0 && <p className="text-sm text-muted-foreground">Nobody is away on this day.</p>}
            <ul className="-my-2 divide-y">
              {dayList.map((a) => {
                const body = (
                  <>
                    <Avatar name={a.employeeName} className="size-9" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{a.mine ? 'You' : a.employeeName}</span>
                      <span className="block font-mono text-xs text-muted-foreground">
                        {fmtDate(a.fromDate)} to {fmtDate(a.toDate)}
                      </span>
                    </span>
                    {a.status !== 'APPROVED' && <StatusChip status={a.status} />}
                  </>
                );
                return (
                  <li key={a.id}>
                    {a.canOpen ? (
                      <Link to={`/leaves/${a.id}`} className="flex items-center gap-3 py-3 hover:bg-accent/50">
                        {body}
                      </Link>
                    ) : (
                      <div className="flex items-center gap-3 py-3">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Panel>
          <p className="px-1 text-xs text-muted-foreground">
            Faded faces with a dashed ring are requests that are still waiting for an answer.
          </p>
        </aside>
      </div>
    </section>
  );
}
