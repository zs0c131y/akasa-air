import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, FilePlus2, Inbox, UserPlus } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Avatar, ErrorBox, PageHeader, Panel, fmtDate, fmtDateTime } from '../components.jsx';
import { Button } from '../ui/button.jsx';
import { Skeleton } from '../ui/skeleton.jsx';
import { cn } from '../lib/utils.js';

function Stat({ label, value, note, to, tone }) {
  const body = (
    <>
      <p className="kicker">{label}</p>
      <p className={cn('num mt-2 font-display text-5xl leading-none', tone)}>{value}</p>
      {note && <p className="mt-2 text-sm text-muted-foreground">{note}</p>}
    </>
  );
  const box = 'block rounded-lg border bg-card p-5 shadow-soft';
  return to ? <Link to={to} className={cn(box, 'transition-colors hover:border-foreground/30')}>{body}</Link> : <div className={box}>{body}</div>;
}

const waited = (q) => (q.oldestWaitingHours < 1 ? 'Under an hour' : q.oldestWaitingHours < 24 ? plural(q.oldestWaitingHours, 'hour') : plural(q.oldestWaitingDays, 'day'));
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const hours = (h) => (h === null ? 'No decisions yet' : h < 1 ? 'Under an hour' : h < 48 ? `${Math.round(h)} hours` : `${Math.round(h / 24)} days`);

export default function HomePage() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { api.stats().then(setStats).catch(setError); }, []);

  const approver = user.role !== 'EMPLOYEE';
  const first = user.name.split(' ')[0];
  const q = stats?.queue;
  const next = stats?.mine.next;
  return (
    <section>
      <PageHeader kicker={approver ? 'Overview' : 'Your leave'} title={`Hello, ${first}`} description={approver ? 'What is waiting for you, and who is away this week.' : 'Where your requests stand, and what is coming up.'}>
        <Button asChild variant="brand"><Link to="/apply"><FilePlus2 />New request</Link></Button>
      </PageHeader>
      <ErrorBox error={error} className="mb-4" />
      {user.role === 'HOD' && stats?.awaitingSetup > 0 && (
        <Link to="/holidays?tab=places" className="mb-6 flex items-center gap-4 rounded-lg border border-status-amber-fg/30 bg-status-amber-bg p-4 text-status-amber-fg transition-colors hover:border-status-amber-fg/60 sm:p-5">
          <UserPlus className="size-6 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{stats.awaitingSetup} {stats.awaitingSetup === 1 ? 'person has' : 'people have'} signed up and {stats.awaitingSetup === 1 ? 'is' : 'are'} waiting for a manager</span>
            <span className="block text-sm">They cannot apply for leave until you choose one.</span>
          </span>
          <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
        </Link>
      )}
      {!stats && !error && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" role="status" aria-label="Loading overview">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-lg" />)}</div>}
      {stats && (
        <div className="space-y-8">
          {approver && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Stat label="Waiting for you" value={q.waiting} to="/queue" tone={q.waiting > 0 ? 'text-brand' : undefined}
                note={q.waiting === 0 ? 'Nothing to decide right now.' : q.long ? `${q.long} ${q.long === 1 ? 'is' : 'are'} more than 3 days in a row.` : 'None of them is longer than 3 days in a row.'} />
              <Stat label="Oldest request" value={q.waiting ? waited(q) : 'None'} to="/queue"
                note={q.oldestName ? `${q.oldestName}'s request has been with you since ${fmtDateTime(q.oldestSince)}.` : 'The queue is clear.'} />
              <Stat label="Away this week" value={stats.team.awayThisWeek} to="/calendar" note={`${stats.team.awayToday} away today.`} />
              <Stat label="Time to decide" value={hours(stats.decisions.medianHours)} note={stats.decisions.decided ? `Typical, from the last ${plural(stats.decisions.decided, 'decision')}.` : 'Shows up after the first decision.'} />
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <Panel title="Your leave" kicker={String(new Date().getFullYear())}>
              <dl className="grid grid-cols-2 gap-4">
                <div><dt className="kicker">Open requests</dt><dd className="num mt-1 font-display text-4xl leading-none">{stats.mine.open}</dd></div>
                <div><dt className="kicker">Approved days</dt><dd className="num mt-1 font-display text-4xl leading-none">{stats.mine.approvedDaysThisYear}</dd></div>
              </dl>
              <div className="mt-6 border-t pt-5">
                <p className="kicker mb-2">Next time off</p>
                {next ? (
                  <Link to={`/leaves/${next.id}`} className="flex items-center gap-3 rounded-md hover:bg-accent/50">
                    <CalendarDays className="size-5 text-brand" aria-hidden="true" />
                    <span className="flex-1"><span className="block font-semibold">{fmtDate(next.fromDate)} to {fmtDate(next.toDate)}</span><span className="text-sm text-muted-foreground">{plural(next.days, 'leave day')}</span></span>
                    <ArrowRight className="size-4 text-muted-foreground" aria-hidden="true" />
                  </Link>
                ) : <p className="text-muted-foreground">Nothing booked yet.</p>}
              </div>
              <div className="mt-5 flex flex-wrap gap-2.5">
                <Button asChild variant="outline"><Link to="/mine">All my requests</Link></Button>
                <Button asChild variant="outline"><Link to="/calendar">Team calendar</Link></Button>
              </div>
            </Panel>

            <Panel title={approver ? 'Where to go next' : 'Good to know'}>
              {approver ? (
                <ul className="-my-2 divide-y">
                  <li><Link to="/queue" className="flex items-center gap-3 py-3 hover:bg-accent/50"><Inbox className="size-5 text-brand" aria-hidden="true" /><span className="flex-1"><span className="block font-semibold">Approval queue</span><span className="text-sm text-muted-foreground">{q.waiting ? `${plural(q.waiting, 'request')} waiting for your answer` : 'Nothing waiting'}</span></span><ArrowRight className="size-4 text-muted-foreground" aria-hidden="true" /></Link></li>
                  <li><Link to="/calendar" className="flex items-center gap-3 py-3 hover:bg-accent/50"><CalendarDays className="size-5 text-brand" aria-hidden="true" /><span className="flex-1"><span className="block font-semibold">Team calendar</span><span className="text-sm text-muted-foreground">See who is away before you approve</span></span><ArrowRight className="size-4 text-muted-foreground" aria-hidden="true" /></Link></li>
                </ul>
              ) : (
                <ul className="space-y-3 text-sm text-muted-foreground">
                  <li className="flex gap-3"><Avatar name={user.name} className="size-8" /><span>Leave of more than 3 days in a row needs a document and two approvals, so apply early.</span></li>
                  <li>Sundays and public holidays are not counted against your leave.</li>
                </ul>
              )}
            </Panel>
          </div>
        </div>
      )}
    </section>
  );
}
