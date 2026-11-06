import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { rejectSchema, infoRequestSchema, zodFields } from '@lms/shared';
import { api } from '../api.js';
import { ACTION_LABELS, Badges, ErrorBox, FieldError, StatusChip, fmtDate, fmtDateTime } from '../components.jsx';
import { useAuth } from '../auth.jsx';

export default function DetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [leave, setLeave] = useState(null);
  const [error, setError] = useState(null);
  const [fields, setFields] = useState({});
  const [comment, setComment] = useState('');
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api.get(id).then(setLeave).catch(setError), [id]);
  useEffect(() => { load(); }, [load]);

  if (error && !leave) return <ErrorBox error={error} />;
  if (!leave) return <p className="muted">Loading…</p>;

  const can = (a) => leave.allowedActions.includes(a);
  const isOwner = leave.employeeId === user.id;

  const run = async (fn) => {
    setBusy(true);
    setError(null);
    setFields({});
    try {
      setLeave(await fn());
      setComment('');
      setFiles([]);
    } catch (err) {
      setError(err);
      setFields(err.fields ?? {});
      if (err.status === 409) load();
    } finally {
      setBusy(false);
    }
  };

  const decide = (action, schema) => () => {
    if (schema) {
      const r = schema.safeParse({ comment });
      if (!r.success) return setFields(zodFields(r.error));
    }
    run(() => api.act(id, action, { comment, version: leave.version }));
  };
  const form = (extra = {}) => {
    const f = new FormData();
    Object.entries(extra).forEach(([k, v]) => f.append(k, v));
    files.forEach((x) => f.append('documents', x));
    return f;
  };
  const picker = (
    <>
      <label htmlFor="more-docs">Attach documents (PDF, JPG or PNG, up to 5 MB each)</label>
      <input id="more-docs" type="file" multiple accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setFiles([...e.target.files])} />
      <FieldError msg={fields.documents} />
    </>
  );

  const isApprover = can('APPROVE');
  return (
    <article className="card">
      <p><Link to={-1}>← Back</Link></p>
      <div className="top">
        <h1>{leave.employeeName}</h1>
        <StatusChip status={leave.status} />
      </div>
      <p>
        {fmtDate(leave.fromDate)} → {fmtDate(leave.toDate)} · <strong>{leave.days} day{leave.days > 1 ? 's' : ''}</strong>{' '}
        <Badges leave={leave} />
      </p>
      <p>{leave.reason}</p>
      {leave.documentsPending && (
        <div className="notice">Supporting documents are still due by {fmtDate(leave.documentsDueBy)} (before returning to work or taking other leave).</div>
      )}
      {leave.isLong && <p className="muted">Long leave: needs approval from the manager and then the HOD.</p>}

      <h2>Documents</h2>
      {leave.documents.length === 0 ? <p className="muted">No documents attached.</p> : (
        <ul>
          {leave.documents.map((d) => (
            <li key={d.id}><button className="link" onClick={() => api.openDocument(leave.id, d.id).catch(setError)}>{d.name}</button> <span className="muted">({Math.round(d.size / 1024) || 1} KB)</span></li>
          ))}
        </ul>
      )}

      <ErrorBox error={error} />

      {isApprover && (
        <section className="actions">
          <h2>Your decision</h2>
          <label htmlFor="comment">Comment (required to reject or ask for information)</label>
          <textarea id="comment" rows="3" value={comment} onChange={(e) => setComment(e.target.value)} />
          <FieldError msg={fields.comment} />
          <div className="btns">
            <button className="approve" disabled={busy} onClick={decide('approve')}>Approve</button>
            <button className="reject" disabled={busy} onClick={decide('reject', rejectSchema)}>Reject</button>
            <button className="secondary" disabled={busy} onClick={decide('request-info', infoRequestSchema)}>Ask for more information</button>
          </div>
        </section>
      )}

      {can('REPLY') && (
        <section className="actions">
          <h2>Reply to the question</h2>
          <label htmlFor="reply">Your reply</label>
          <textarea id="reply" rows="3" value={comment} onChange={(e) => setComment(e.target.value)} />
          <FieldError msg={fields.message} />
          {picker}
          <button className="primary" disabled={busy} onClick={() => run(() => api.reply(id, form({ message: comment })))}>Send reply</button>
        </section>
      )}

      {can('ATTACH') && (isOwner) && (leave.documentsPending || leave.documents.length < 5) && (
        <section className="actions">
          <h2>{leave.documentsPending ? 'Send the supporting documents' : 'Add more documents'}</h2>
          {picker}
          <button className="primary" disabled={busy || files.length === 0} onClick={() => run(() => api.attach(id, form()))}>Upload</button>
        </section>
      )}

      {isOwner && (can('EDIT') || can('CANCEL')) && (
        <div className="btns">
          {can('EDIT') && <Link className="button secondary" to={`/leaves/${id}/edit`}>Edit request</Link>}
          {can('CANCEL') && <button className="reject" disabled={busy} onClick={() => run(() => api.act(id, 'cancel'))}>Cancel request</button>}
        </div>
      )}

      <h2>History</h2>
      <ol className="timeline">
        {leave.timeline.map((t, i) => (
          <li key={i}>
            <strong>{ACTION_LABELS[t.action] ?? t.action}</strong> by {t.actorName} ({t.actorRole}) · <span className="muted">{fmtDateTime(t.at)}</span>
            {t.comment && <div className="quote">{t.comment}</div>}
          </li>
        ))}
      </ol>
    </article>
  );
}
