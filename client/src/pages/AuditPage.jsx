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
  'LEAVE_REPLY', 'LEAVE_CANCEL', 'DOCUMENT_UPLOADED', 'DOCUMENT_VIEWED', 'HOLIDAY_ADDED', 'HOLIDAY_REMOVED', 'HOLIDAYS_IMPORTED', 'LOCATION_ADDED', 'LOCATION_REMOVED', 'LOCATION_CHANGED', 'SPLIT_LEAVE_FLAGGED', 'SIGNUP', 'EMAIL_CONFIRMED', 'PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET', 'PASSWORD_CHANGED', 'MANAGER_ASSIGNED', 'ROLE_CHANGED', 'ACCESS_DENIED',
];
const RED = ['ACCESS_DENIED', 'LOGIN_FAILED', 'LEAVE_REJECT'];
const BLUE = ['LEAVE_SUBMITTED', 'LEAVE_EDITED', 'LEAVE_REPLY', 'DOCUMENT_UPLOADED', 'DOCUMENT_VIEWED'];
function tone(a) {
  if (RED.includes(a)) return 'red';
  if (a === 'LEAVE_APPROVE') return 'green';
  if (a === 'LEAVE_REQUEST_INFO') return 'purple';
  if (a.startsWith('HOLIDAY') || a === 'SPLIT_LEAVE_FLAGGED') return 'amber';
  if (BLUE.includes(a)) return 'blue';
  return 'neutral';
}
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
        kicker="Head of Department"
        title="Audit log"
        description="Who did what, and when: sign-ins, requests, decisions, documents opened, holiday and account changes, and anything that was refused."
      />
      <div className="mb-5 grid gap-4 rounded-lg border bg-card p-4 shadow-soft sm:grid-cols-[14rem_minmax(0,22rem)] sm:p-5">
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
            <Input id="search" type="search" value={q} placeholder="A name or a detail" className="pl-9" onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          </div>
        </div>
      </div>
      <ErrorBox error={error} className="mb-4" />
      {!data && <div className="space-y-2" role="status" aria-label="Loading audit log">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>}
      {data?.items.length === 0 && <p className="rounded-lg border border-dashed bg-card/50 py-14 text-center text-muted-foreground">Nothing matches. Clear the search or pick another event.</p>}
      <ul className="space-y-2">
        {data?.items.map((i) => (
          <li key={i.id} className="grid gap-2 rounded-lg border bg-card p-4 shadow-soft sm:grid-cols-[10.5rem_minmax(0,1fr)_auto] sm:gap-5">
            <div><Badge variant={tone(i.action)} className="font-mono text-[0.7rem] uppercase tracking-[0.08em]">{label(i.action)}</Badge></div>
            <div className="min-w-0">
              <p>
                <strong className="font-semibold">{i.actorName}</strong> {i.actorRole && <span className="text-muted-foreground">({i.actorRole})</span>}
                {i.employeeName && <> on <strong className="font-semibold">{i.employeeName}</strong>&rsquo;s request</>}
              </p>
              {(i.fromStatus || i.toStatus) && <p className="text-sm text-muted-foreground">Status: {i.fromStatus ?? 'none'} to {i.toStatus ?? 'none'}</p>}
              {i.detail && <p className="text-sm">{i.detail}</p>}
              <p className="mt-1 font-mono text-xs text-muted-foreground">IP {i.ip ?? 'unknown'}{i.entityId && <> · <Link className="underline underline-offset-2 hover:text-foreground" to={`/leaves/${i.entityId}`}>Open request</Link></>}</p>
            </div>
            <time className="font-mono text-xs text-muted-foreground sm:text-right" dateTime={new Date(i.at).toISOString()}>{fmtDateTime(i.at)}</time>
          </li>
        ))}
      </ul>
      <Pager page={page} pages={pages} setPage={setPage} />
    </section>
  );
}
