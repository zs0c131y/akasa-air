import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, FileText, MessageCircleQuestion, Pencil, Send, Upload, Users, X } from 'lucide-react';
import { rejectSchema, infoRequestSchema, excludedSummary, zodFields } from '@lms/shared';
import { api } from '../api.js';
import {
  ACTION_LABELS,
  Avatar,
  Badges,
  ErrorBox,
  ErrorScreen,
  FieldError,
  Notice,
  Panel,
  StatusChip,
  fmtDate,
  fmtDateTime,
} from '../components.jsx';
import { useAuth } from '../auth.jsx';
import { Button } from '../ui/button.jsx';
import { Input, Label, Textarea } from '../ui/input.jsx';
import { Skeleton } from '../ui/skeleton.jsx';

/** Who else on the team is away on the same days, shown to the person who has to decide. */
function Overlaps({ overlaps, managers }) {
  const { away, teamSize, items } = overlaps;
  if (away === 0) {
    return (
      <p className="rounded-lg border bg-card p-4 text-sm text-muted-foreground shadow-soft">
        {managers ? 'No other manager is away on those days.' : 'Nobody else on the team is away on those days.'}
      </p>
    );
  }
  const noun = managers ? (teamSize === 1 ? 'manager' : 'managers') : teamSize === 1 ? 'teammate' : 'teammates';
  return (
    <section
      aria-label="Who else is away"
      className="rounded-lg border border-status-amber-fg/30 bg-status-amber-bg p-4 text-status-amber-fg"
    >
      <h2 className="flex gap-2 font-semibold">
        <Users className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <span>
          {away} of {teamSize} {noun} {away === 1 ? 'is' : 'are'} away on those days
        </span>
      </h2>
      <ul className="mt-3 space-y-2.5">
        {items.map((o) => (
          <li key={o.id} className="flex items-center gap-3">
            <Avatar name={o.name} className="size-9 shrink-0" />
            <span className="min-w-0 text-sm">
              <span className="block font-semibold">{o.name}</span>
              <span className="block">
                {fmtDate(o.fromDate)} to {fmtDate(o.toDate)}, {o.approved ? 'approved' : 'waiting for an answer'}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function DetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [leave, setLeave] = useState(null);
  const [error, setError] = useState(null);
  const [fields, setFields] = useState({});
  const [comment, setComment] = useState('');
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api.get(id).then(setLeave).catch(setError), [id]);
  useEffect(() => {
    load();
  }, [load]);

  if (error && !leave) return <ErrorScreen error={error} />;
  if (!leave) {
    return (
      <div className="space-y-4" role="status" aria-label="Loading request">
        <Skeleton className="h-10 w-28" />
        <Skeleton className="h-56 max-w-3xl rounded-lg" />
        <Skeleton className="h-40 max-w-3xl rounded-lg" />
      </div>
    );
  }

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
    return run(() => api.act(id, action, { comment, version: leave.version }));
  };
  const form = (extra = {}) => {
    const f = new FormData();
    Object.entries(extra).forEach(([k, v]) => f.append(k, v));
    files.forEach((x) => f.append('documents', x));
    return f;
  };
  const picker = (
    <div>
      <Label htmlFor="more-docs">Attach documents</Label>
      <Input
        id="more-docs"
        type="file"
        multiple
        accept=".pdf,.jpg,.jpeg,.png"
        onChange={(e) => setFiles([...e.target.files])}
        className="h-auto py-2"
      />
      <p className="mt-1.5 text-sm text-muted-foreground">PDF, JPG or PNG, up to 5 MB each.</p>
      <FieldError msg={fields.documents} />
    </div>
  );

  const isApprover = can('APPROVE');
  // Documents belong to long leave only; the server refuses them otherwise.
  const showUpload = can('ATTACH') && isOwner && leave.isLong && (leave.documentsPending || leave.documents.length < 5);
  const hasSidePanel = isApprover || can('REPLY') || showUpload || (isOwner && (can('EDIT') || can('CANCEL')));
  const note = leave.excluded ? excludedSummary(leave.excluded) : '';

  return (
    <article>
      <Button variant="ghost" size="sm" className="-ml-3 mb-5 text-muted-foreground" onClick={() => navigate(-1)}>
        <ArrowLeft />
        Back
      </Button>

      <div className={hasSidePanel ? 'grid gap-6 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start' : 'grid max-w-3xl gap-6'}>
        <Panel as="div" className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <Avatar name={leave.employeeName} className="size-14" />
              <div className="min-w-0">
                <p className="kicker">Leave request</p>
                <h1 className="font-display mt-1 text-2xl leading-tight sm:text-3xl">{leave.employeeName}</h1>
              </div>
            </div>
            <StatusChip status={leave.status} leave={leave} />
          </div>

          <dl className="grid gap-x-8 gap-y-5 border-t pt-5 sm:grid-cols-2">
            <div>
              <dt className="kicker">Dates</dt>
              <dd className="mt-1.5 font-mono text-sm">
                {fmtDate(leave.fromDate)} <span className="text-muted-foreground">to</span> {fmtDate(leave.toDate)}
              </dd>
            </div>
            <div>
              <dt className="kicker">Counted as leave</dt>
              <dd className="mt-1">
                <span className="num font-display text-3xl leading-none">{leave.days}</span>
                <span className="ml-1.5 text-sm font-medium">day{leave.days === 1 ? '' : 's'}</span>
                {note && <span className="mt-1 block text-sm text-muted-foreground">{note}</span>}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="kicker">Reason</dt>
              <dd className="mt-1.5 text-lg leading-snug">{leave.reason}</dd>
            </div>
          </dl>

          <div className="flex flex-wrap items-center gap-2 empty:hidden">
            <Badges leave={leave} />
          </div>
          {leave.joinedWith?.length > 0 && (
            <Notice className={isApprover ? 'ring-2 ring-status-amber-fg/40' : undefined}>
              This request follows other leave from the same person:{' '}
              {leave.joinedWith.map((j, i) => (
                <span key={j.id}>
                  {i > 0 && ', '}
                  <Link to={`/leaves/${j.id}`} className="font-semibold underline underline-offset-2">
                    {fmtDate(j.fromDate)} to {fmtDate(j.toDate)}
                  </Link>
                </span>
              ))}
              . Together that is {leave.absenceDays} days in a row, so it needs a document and the HOD's approval.
            </Notice>
          )}
          {leave.onBehalfOf && (
            <Notice>
              {isApprover
                ? `${leave.onBehalfOf} is on leave, so this request came to you. You are answering on their behalf.`
                : isOwner
                  ? `${leave.onBehalfOf}, your manager, is on leave, so the head of department will answer this on their behalf.`
                  : `${leave.onBehalfOf}, ${leave.employeeName}'s manager, is on leave, so the head of department will answer this on their behalf.`}
            </Notice>
          )}
          {leave.isLong && (
            <p className="text-sm text-muted-foreground">
              This is long leave (more than 3 days in a row), so it needs a yes from the manager and then from the HOD.
            </p>
          )}
          {leave.documentsPending && (
            <Notice>
              Supporting documents are due by {fmtDate(leave.documentsDueBy)}. Send them before you return to work or ask for other leave.
            </Notice>
          )}
        </Panel>

        {hasSidePanel && (
          <aside aria-label="Actions" className="space-y-4 lg:sticky lg:top-36 lg:col-start-2 lg:row-span-3 lg:row-start-1">
            <ErrorBox error={error} />
            {isApprover && leave.overlaps && (
              <Overlaps overlaps={leave.overlaps} managers={user.role === 'HOD' && leave.status === 'PENDING_MANAGER'} />
            )}
            {isApprover && (
              <Panel title="Your decision">
                <Label htmlFor="comment">Comment</Label>
                <Textarea
                  id="comment"
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  aria-invalid={Boolean(fields.comment)}
                />
                <p className="mt-1.5 text-sm text-muted-foreground">Needed if you reject or ask for more information.</p>
                <FieldError msg={fields.comment} />
                <div className="mt-5 grid gap-2.5">
                  <Button variant="success" disabled={busy} onClick={decide('approve')}>
                    <Check />
                    Approve
                  </Button>
                  <div className="grid grid-cols-2 gap-2.5">
                    <Button variant="outline" disabled={busy} onClick={decide('request-info', infoRequestSchema)}>
                      <MessageCircleQuestion />
                      Ask
                    </Button>
                    <Button variant="destructive" disabled={busy} onClick={decide('reject', rejectSchema)}>
                      <X />
                      Reject
                    </Button>
                  </div>
                </div>
              </Panel>
            )}
            {can('REPLY') && (
              <Panel title="Reply to the question">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="reply">Your reply</Label>
                    <Textarea
                      id="reply"
                      rows={3}
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      aria-invalid={Boolean(fields.message)}
                    />
                    <FieldError msg={fields.message} />
                  </div>
                  {leave.isLong && picker}
                  <Button variant="brand" disabled={busy} onClick={() => run(() => api.reply(id, form({ message: comment })))}>
                    <Send />
                    Send reply
                  </Button>
                </div>
              </Panel>
            )}
            {showUpload && (
              <Panel title={leave.documentsPending ? 'Send the supporting documents' : 'Add more documents'}>
                <div className="space-y-4">
                  {picker}
                  <Button variant="brand" disabled={busy || files.length === 0} onClick={() => run(() => api.attach(id, form()))}>
                    <Upload />
                    Upload
                  </Button>
                </div>
              </Panel>
            )}
            {isOwner && (can('EDIT') || can('CANCEL')) && (
              <div className="flex flex-wrap gap-2.5">
                {can('EDIT') && (
                  <Button asChild variant="outline">
                    <Link to={`/leaves/${id}/edit`}>
                      <Pencil />
                      Edit request
                    </Link>
                  </Button>
                )}
                {can('CANCEL') && (
                  <Button variant="outline" className="text-destructive" disabled={busy} onClick={() => run(() => api.act(id, 'cancel'))}>
                    Cancel request
                  </Button>
                )}
              </div>
            )}
          </aside>
        )}
        {!hasSidePanel && error && <ErrorBox error={error} />}

        <Panel title="Documents">
          {leave.documents.length === 0 ? (
            <p className="text-muted-foreground">
              {leave.isLong ? 'No documents attached yet.' : 'Leave of this length needs no documents.'}
            </p>
          ) : (
            <ul className="-my-1 divide-y">
              {leave.documents.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => api.openDocument(leave.id, d.id).catch(setError)}
                    className="flex min-h-12 w-full items-center gap-3 rounded-md py-2 text-left transition-colors hover:bg-accent/60"
                  >
                    <FileText className="size-5 shrink-0 text-brand" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate font-medium">{d.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">{Math.round(d.size / 1024) || 1} KB</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="History">
          <ol className="relative ml-1 space-y-6 border-l pl-6">
            {leave.timeline.map((t, i) => (
              <li key={i} className="relative">
                <span aria-hidden="true" className="absolute -left-[1.9rem] top-1.5 size-2.5 rounded-full bg-foreground ring-4 ring-card" />
                <p>
                  <strong className="font-semibold">{ACTION_LABELS[t.action] ?? t.action}</strong>{' '}
                  <span className="text-muted-foreground">
                    by {t.actorName}
                    {t.actorRole ? ` (${t.actorRole})` : ''}
                  </span>
                </p>
                <p className="font-mono text-xs text-muted-foreground">{fmtDateTime(t.at)}</p>
                {t.comment && (
                  <blockquote className="mt-2 rounded-md border-l-2 border-flame bg-secondary px-3 py-2 text-sm">{t.comment}</blockquote>
                )}
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    </article>
  );
}
