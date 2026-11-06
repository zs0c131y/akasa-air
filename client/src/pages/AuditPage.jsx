import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { ErrorBox, ErrorScreen, fmtDateTime } from '../components.jsx';

const ACTIONS = [
  'LOGIN', 'LOGIN_FAILED', 'LEAVE_SUBMITTED', 'LEAVE_EDITED', 'LEAVE_APPROVE', 'LEAVE_REJECT', 'LEAVE_REQUEST_INFO',
  'LEAVE_REPLY', 'LEAVE_CANCEL', 'DOCUMENT_UPLOADED', 'DOCUMENT_VIEWED', 'ACCESS_DENIED',
];
const tone = (a) => (a === 'ACCESS_DENIED' || a === 'LOGIN_FAILED' || a === 'LEAVE_REJECT' ? 'bad' : a.includes('APPROVE') ? 'good' : 'neutral');
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
      <h1>Audit log</h1>
      <p className="muted">A permanent record of sign-ins, submissions, decisions, document access and denied attempts. Entries cannot be edited or deleted.</p>
      <div className="filters">
        <label className="inline">Event
          <select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}>
            <option value="">All events</option>
            {ACTIONS.map((a) => <option key={a} value={a}>{label(a)}</option>)}
          </select>
        </label>
        <label className="inline">Search
          <input type="search" value={q} placeholder="Name or detail" onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        </label>
      </div>
      <ErrorBox error={error} />
      {!data && <p className="muted">Loading…</p>}
      {data?.items.length === 0 && <p className="empty">No matching entries.</p>}
      <ul className="cards">
        {data?.items.map((i) => (
          <li key={i.id} className="audit-item">
            <div className="top">
              <span className={`tag tag-${tone(i.action)}`}>{label(i.action)}</span>
              <span className="muted">{fmtDateTime(i.at)}</span>
            </div>
            <div><strong>{i.actorName}</strong> {i.actorRole && <span className="muted">({i.actorRole})</span>}
              {i.employeeName && <> on <strong>{i.employeeName}</strong>'s request</>}</div>
            {(i.fromStatus || i.toStatus) && <div className="muted">Status: {i.fromStatus ?? '—'} → {i.toStatus ?? '—'}</div>}
            {i.detail && <div>{i.detail}</div>}
            <div className="muted small">IP {i.ip ?? 'unknown'}{i.entityId && <> · <Link to={`/leaves/${i.entityId}`}>Open request</Link></>}</div>
          </li>
        ))}
      </ul>
      {pages > 1 && (
        <div className="pager">
          <button className="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span>Page {page} of {pages}</span>
          <button className="secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
    </section>
  );
}
