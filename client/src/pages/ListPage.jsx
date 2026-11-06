import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, FilePlus2 } from 'lucide-react';
import { STATUSES, STATUS_LABELS } from '@lms/shared';
import { api } from '../api.js';
import { Avatar, Badges, DaysLabel, ErrorBox, PageHeader, Pager, STATUS_BAR, StatusChip, fmtDate } from '../components.jsx';
import { EmptyTray } from '../illustrations.jsx';
import { Button } from '../ui/button.jsx';
import { Skeleton } from '../ui/skeleton.jsx';
import { cn } from '../lib/utils.js';

export default function ListPage({ scope, title, description, kicker }) {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setData(null);
    api.list({ scope, page, ...(status ? { status } : {}) }).then(setData).catch(setError);
  }, [scope, status, page]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const pick = (s) => { setStatus(s); setPage(1); };
  const emptyTitle = scope === 'queue' ? 'Nothing is waiting for you' : status ? 'No requests with that status' : 'No requests yet';
  const emptyHint = scope === 'queue'
    ? 'When someone files a request for you to decide, it will show up here.'
    : status ? 'Pick All to see every request again.' : scope === 'mine' ? 'Start a new request and it will appear here.' : 'Requests you can see will appear here.';
  return (
    <section>
      <PageHeader title={title} description={description} kicker={kicker}>
        {scope === 'mine' && <Button asChild variant="brand"><Link to="/apply"><FilePlus2 />New request</Link></Button>}
      </PageHeader>

      {scope !== 'queue' && (
        <div role="group" aria-label="Filter by status" className="mb-6 flex flex-wrap items-center gap-2">
          {['', ...STATUSES].map((s) => (
            <button
              key={s || 'all'}
              type="button"
              aria-pressed={status === s}
              onClick={() => pick(s)}
              className={cn(
                'inline-flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors',
                status === s ? 'border-foreground bg-foreground text-background' : 'bg-card hover:bg-accent',
              )}
            >
              {s && <span aria-hidden="true" className={cn('size-2 rounded-full', STATUS_BAR[s])} />}
              {s ? STATUS_LABELS[s] : 'All'}
            </button>
          ))}
        </div>
      )}

      <ErrorBox error={error} className="mb-4" />
      {!data && !error && (
        <div className="space-y-3" role="status" aria-label="Loading requests">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
      )}
      {data && data.items.length === 0 && (
        <div className="grid place-items-center rounded-lg border border-dashed bg-card/50 px-6 py-14 text-center">
          <EmptyTray />
          <p className="font-display mt-5 text-xl">{emptyTitle}</p>
          <p className="mt-1.5 max-w-sm text-muted-foreground">{emptyHint}</p>
        </div>
      )}
      <ul className="space-y-3">
        {data?.items.map((l) => (
          <li key={l.id}>
            <Link
              to={`/leaves/${l.id}`}
              className="group relative flex items-start gap-4 overflow-hidden rounded-lg border bg-card py-4 pl-5 pr-4 shadow-soft transition-colors hover:border-foreground/40 sm:items-center sm:gap-5 sm:py-5"
            >
              <span aria-hidden="true" className={cn('absolute inset-y-0 left-0 w-1', STATUS_BAR[l.status])} />
              <Avatar name={l.employeeName} className="size-11 sm:size-12" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                  <p className="text-base font-semibold">{l.employeeName}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {fmtDate(l.fromDate)} to {fmtDate(l.toDate)}
                  </p>
                </div>
                <p className="mt-0.5 truncate text-sm text-muted-foreground">{l.reason}</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
                  <DaysLabel leave={l} className="text-sm" />
                  <Badges leave={l} />
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-3 sm:flex-row sm:items-center">
                <StatusChip status={l.status} leave={l} />
                <ArrowRight className="hidden size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground sm:block" aria-hidden="true" />
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <Pager page={page} pages={pages} setPage={setPage} />
    </section>
  );
}
