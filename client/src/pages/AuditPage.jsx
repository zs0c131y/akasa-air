import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { api } from '../api.js';
import { ErrorBox, ErrorScreen, PageHeader, Pager, fmtDateTime } from '../components.jsx';
import { Badge } from '../ui/badge.jsx';
import { Input, Label, Select } from '../ui/input.jsx';
import { Skeleton } from '../ui/skeleton.jsx';

const ACTIONS = [
  'LOGIN', 'LOGIN_FAILED', 'LEAVE_SUBMITTED', 'LEAVE_EDITED', 'LEAVE_APPROVE', 'LEAVE_REJECT', 'LEAVE_REQUEST_INFO',
  'LEAVE_REPLY', 'LEAVE_CANCEL', 'DOCUMENT_UPLOADED', 'DOCUMENT_VIEWED', 'ACCESS_DENIED',
];
const tone = (a) => (a === 'ACCESS_DENIED' || a === 'LOGIN_FAILED' || a === 'LEAVE_REJECT' ? 'red' : a.includes('APPROVE') ? 'green' : 'neutral');
const label = (a) => a.replace('LEAVE_', '').replaceAll('_', ' ').toLowerCase();

export default function AuditPage() {
  const [action, setAction] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setError(null);
    api.audit({ page, ...(action ? { action } : {}), ...(q ? { q } : {}) }).then(setData).catch(setError);
  }, [action, q, page]);

  if (error && !data) return <ErrorScreen error={error} />;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  return (
    <section>
      <PageHeader
        title="Audit log"
        description="A permanent record of sign-ins, submissions, decisions, document access and denied attempts. Entries cannot be edited or deleted."
      />
      <div className="mb-5 grid gap-4 sm:grid-cols-[14rem_minmax(0,22rem)]">
        <div>
          <Label htmlFor="event">Event</Label>
          <Select id="event" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}>
            <option value="">All events</option>
            {ACTIONS.map((a) => <option key={a} value={a}>{label(a)}</option>)}
          </Select>
        </div>
        <div>
          <Label htmlFor="search">Search</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input id="search" type="search" value={q} placeholder="Name or detail" className="pl-9" onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          </div>
        </div>
      </div>
      <ErrorBox error={error} className="mb-4" />
      {!data && <div className="space-y-2" role="status" aria-label="Loading audit log">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}</div>}
      {data?.items.length === 0 && <p className="rounded-xl border border-dashed py-14 text-center text-muted-foreground">No matching entries.</p>}
      <ul className="divide-y overflow-hidden rounded-lg border bg-card shadow-soft">
        {data?.items.map((i) => (
          <li key={i.id} className="grid gap-1 px-4 py-3.5 sm:grid-cols-[9.5rem_minmax(0,1fr)_auto] sm:items-baseline sm:gap-4 sm:px-5">
            <div><Badge variant={tone(i.action)} className="uppercase tracking-wide">{label(i.action)}</Badge></div>
            <div className="min-w-0">
              <p>
                <strong className="font-semibold">{i.actorName}</strong> {i.actorRole && <span className="text-muted-foreground">({i.actorRole})</span>}
                {i.employeeName && <> on <strong className="font-semibold">{i.employeeName}</strong>&rsquo;s request</>}
              </p>
              {(i.fromStatus || i.toStatus) && <p className="text-sm text-muted-foreground">Status: {i.fromStatus ?? '—'} → {i.toStatus ?? '—'}</p>}
              {i.detail && <p className="text-sm">{i.detail}</p>}
              <p className="mt-0.5 text-xs text-muted-foreground">IP {i.ip ?? 'unknown'}{i.entityId && <> · <Link className="underline underline-offset-2 hover:text-foreground" to={`/leaves/${i.entityId}`}>Open request</Link></>}</p>
            </div>
            <time className="text-sm text-muted-foreground sm:text-right" dateTime={new Date(i.at).toISOString()}>{fmtDateTime(i.at)}</time>
          </li>
        ))}
      </ul>
      <Pager page={page} pages={pages} setPage={setPage} />
    </section>
  );
}
