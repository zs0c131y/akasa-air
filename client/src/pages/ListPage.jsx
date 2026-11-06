import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { STATUSES, STATUS_LABELS } from '@lms/shared';
import { api } from '../api.js';
import { Badges, ErrorBox, StatusChip, StatusLegend, fmtDate } from '../components.jsx';

export default function ListPage({ scope, title }) {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setData(null);
    api.list({ scope, page, ...(status ? { status } : {}) }).then(setData).catch(setError);
  }, [scope, status, page]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  return (
    <section>
      <div className="head">
        <h1>{title}</h1>
        {scope !== 'queue' && (
          <label className="inline">
            Status
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">All</option>
              {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
          </label>
        )}
      </div>
      <StatusLegend />
      <ErrorBox error={error} />
      {!data && !error && <p className="muted">Loading…</p>}
      {data && data.items.length === 0 && <p className="empty">Nothing here yet.</p>}
      <ul className="cards">
        {data?.items.map((l) => (
          <li key={l.id}>
            <Link to={`/leaves/${l.id}`} className={`leave-card card-${l.status}`}>
              <div className="top">
                <strong>{l.employeeName}</strong>
                <StatusChip status={l.status} />
              </div>
              <div>{fmtDate(l.fromDate)} → {fmtDate(l.toDate)} · {l.days} day{l.days > 1 ? 's' : ''}</div>
              <div className="muted clip">{l.reason}</div>
              <div><Badges leave={l} /></div>
            </Link>
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
