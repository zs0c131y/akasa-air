import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, FilePlus2, Inbox } from 'lucide-react';
import { STATUSES } from '@lms/shared';
import { api } from '../api.js';
import { Avatar, Badges, ErrorBox, PageHeader, Pager, STATUS_EDGE, StatusChip, fmtDate } from '../components.jsx';
import { Button } from '../ui/button.jsx';
import { Skeleton } from '../ui/skeleton.jsx';
import { cn } from '../lib/utils.js';

export default function ListPage({ scope, title, description }) {
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
  return (
    <section>
      <PageHeader title={title} description={description}>
        {scope === 'mine' && <Button asChild variant="brand"><Link to="/apply"><FilePlus2 />New request</Link></Button>}
      </PageHeader>

      {scope !== 'queue' && (
        <div role="group" aria-label="Filter by status" className="mb-5 flex flex-wrap items-center gap-2">
          <button type="button" aria-pressed={status === ''} onClick={() => pick('')} className={cn('h-9 rounded-full border px-3.5 text-sm font-medium transition-colors', status === '' ? 'border-foreground bg-foreground text-background' : 'bg-card hover:bg-accent')}>
            All
          </button>
          {STATUSES.map((s) => (
            <button key={s} type="button" aria-pressed={status === s} onClick={() => pick(s)} className={cn('rounded-full transition-opacity focus-visible:outline-none', status && status !== s && 'opacity-50 hover:opacity-100', status === s && 'ring-2 ring-foreground ring-offset-2 ring-offset-background')}>
              <StatusChip status={s} className="h-9 px-3" />
            </button>
          ))}
        </div>
      )}

      <ErrorBox error={error} className="mb-4" />
      {!data && !error && (
        <div className="space-y-3" role="status" aria-label="Loading requests">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
      )}
      {data && data.items.length === 0 && (
        <div className="grid place-items-center rounded-xl border border-dashed py-16 text-center">
          <Inbox className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 font-medium">{scope === 'queue' ? 'Nothing is waiting for you' : 'No requests here yet'}</p>
          <p className="mt-1 text-sm text-muted-foreground">{scope === 'queue' ? 'New requests will appear here as soon as they are submitted.' : 'Try another filter, or start a new request.'}</p>
        </div>
      )}
      <ul className="space-y-3">
        {data?.items.map((l) => (
          <li key={l.id}>
            <Link
              to={`/leaves/${l.id}`}
              className={cn('group flex items-start gap-4 rounded-lg border border-l-4 bg-card p-4 shadow-soft transition-all hover:-translate-y-px hover:shadow-lift sm:p-5', STATUS_EDGE[l.status])}
            >
              <Avatar name={l.employeeName} className="hidden sm:inline-grid" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{l.employeeName}</p>
                  <StatusChip status={l.status} />
                </div>
                <p className="mt-1 text-sm">
                  {fmtDate(l.fromDate)} <span aria-hidden="true">→</span><span className="sr-only">to</span> {fmtDate(l.toDate)}
                  <span className="text-muted-foreground"> · {l.days} day{l.days > 1 ? 's' : ''}</span>
                </p>
                <p className="mt-1 truncate text-sm text-muted-foreground">{l.reason}</p>
                <div className="mt-2 flex flex-wrap gap-1.5 empty:hidden"><Badges leave={l} /></div>
              </div>
              <ArrowRight className="mt-1 hidden size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 sm:block" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
      <Pager page={page} pages={pages} setPage={setPage} />
    </section>
  );
}
