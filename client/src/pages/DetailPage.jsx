import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, FileText, MessageCircleQuestion, Paperclip, Pencil, Send, Upload, X } from 'lucide-react';
import { rejectSchema, infoRequestSchema, zodFields } from '@lms/shared';
import { api } from '../api.js';
import { ACTION_LABELS, Avatar, Badges, ErrorBox, ErrorScreen, FieldError, Notice, StatusChip, fmtDate, fmtDateTime } from '../components.jsx';
import { useAuth } from '../auth.jsx';
import { Button } from '../ui/button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card.jsx';
import { Input, Label, Textarea } from '../ui/input.jsx';
import { Skeleton } from '../ui/skeleton.jsx';

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
  useEffect(() => { load(); }, [load]);

  if (error && !leave) return <ErrorScreen error={error} />;
  if (!leave) return <div className="space-y-4" role="status" aria-label="Loading request"><Skeleton className="h-12 w-2/3" /><Skeleton className="h-64" /></div>;

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
      <Input id="more-docs" type="file" multiple accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setFiles([...e.target.files])} className="h-auto py-2" />
      <p className="mt-1.5 text-sm text-muted-foreground">PDF, JPG or PNG, up to 5 MB each.</p>
      <FieldError msg={fields.documents} />
    </div>
  );

  const isApprover = can('APPROVE');
  const showUpload = can('ATTACH') && isOwner && (leave.documentsPending || leave.documents.length < 5);
  const hasSidePanel = isApprover || can('REPLY') || showUpload || (isOwner && (can('EDIT') || can('CANCEL')));

  return (
    <article>
      <Button variant="ghost" size="sm" className="-ml-3 mb-4 text-muted-foreground" onClick={() => navigate(-1)}><ArrowLeft />Back</Button>
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar name={leave.employeeName} className="size-14 text-lg" />
          <div>
            <h1 className="font-display text-4xl leading-none tracking-tight sm:text-5xl">{leave.employeeName}</h1>
            <p className="mt-2 text-muted-foreground">
              {fmtDate(leave.fromDate)} <span aria-hidden="true">→</span><span className="sr-only">to</span> {fmtDate(leave.toDate)} ·{' '}
              <strong className="font-semibold text-foreground">{leave.days} day{leave.days > 1 ? 's' : ''}</strong>
            </p>
          </div>
        </div>
        <StatusChip status={leave.status} className="h-9 px-3.5 text-sm" />
      </header>

      <div className={hasSidePanel ? 'grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start' : 'max-w-3xl'}>
        <div className="space-y-6">
          {leave.documentsPending && (
            <Notice>Supporting documents are still due by {fmtDate(leave.documentsDueBy)}, before returning to work or taking other leave.</Notice>
          )}
          <Card>
            <CardHeader><CardTitle>Reason</CardTitle></CardHeader>
            <CardContent>
              <p className="text-[1.05rem]">{leave.reason}</p>
              <div className="mt-3 flex flex-wrap gap-1.5 empty:hidden"><Badges leave={leave} /></div>
              {leave.isLong && <p className="mt-3 text-sm text-muted-foreground">Long leave: needs approval from the manager and then the HOD.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Paperclip className="size-4" aria-hidden="true" />Documents</CardTitle></CardHeader>
            <CardContent>
              {leave.documents.length === 0 ? <p className="text-muted-foreground">No documents attached.</p> : (
                <ul className="divide-y rounded-lg border">
                  {leave.documents.map((d) => (
                    <li key={d.id}>
                      <button type="button" onClick={() => api.openDocument(leave.id, d.id).catch(setError)} className="flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left hover:bg-accent">
                        <FileText className="size-5 shrink-0 text-brand" aria-hidden="true" />
                        <span className="min-w-0 flex-1 truncate font-medium">{d.name}</span>
                        <span className="text-sm text-muted-foreground">{Math.round(d.size / 1024) || 1} KB</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>History</CardTitle></CardHeader>
            <CardContent>
              <ol className="relative ml-2 space-y-6 border-l pl-6">
                {leave.timeline.map((t, i) => (
                  <li key={i} className="relative">
                    <span aria-hidden="true" className="absolute -left-[1.95rem] top-1.5 size-3 rounded-full border-2 border-card bg-brand" />
                    <p><strong className="font-semibold">{ACTION_LABELS[t.action] ?? t.action}</strong> <span className="text-muted-foreground">by {t.actorName} ({t.actorRole})</span></p>
                    <p className="text-sm text-muted-foreground">{fmtDateTime(t.at)}</p>
                    {t.comment && <blockquote className="mt-2 rounded-md border-l-2 border-brand bg-secondary px-3 py-2 text-sm">{t.comment}</blockquote>}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        {hasSidePanel && (
          <div className="space-y-6 lg:sticky lg:top-24">
            <ErrorBox error={error} />
            {isApprover && (
              <Card>
                <CardHeader><CardTitle>Your decision</CardTitle></CardHeader>
                <CardContent>
                  <Label htmlFor="comment">Comment</Label>
                  <Textarea id="comment" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} aria-invalid={Boolean(fields.comment)} />
                  <p className="mt-1.5 text-sm text-muted-foreground">Required to reject or ask for more information.</p>
                  <FieldError msg={fields.comment} />
                  <div className="mt-5 grid gap-2.5">
                    <Button variant="success" disabled={busy} onClick={decide('approve')}><Check />Approve</Button>
                    <Button variant="destructive" disabled={busy} onClick={decide('reject', rejectSchema)}><X />Reject</Button>
                    <Button variant="outline" disabled={busy} onClick={decide('request-info', infoRequestSchema)}><MessageCircleQuestion />Ask for more information</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {can('REPLY') && (
              <Card>
                <CardHeader><CardTitle>Reply to the question</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="reply">Your reply</Label>
                    <Textarea id="reply" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} aria-invalid={Boolean(fields.message)} />
                    <FieldError msg={fields.message} />
                  </div>
                  {picker}
                  <Button variant="brand" disabled={busy} onClick={() => run(() => api.reply(id, form({ message: comment })))}><Send />Send reply</Button>
                </CardContent>
              </Card>
            )}

            {showUpload && (
              <Card>
                <CardHeader><CardTitle>{leave.documentsPending ? 'Send the supporting documents' : 'Add more documents'}</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {picker}
                  <Button variant="brand" disabled={busy || files.length === 0} onClick={() => run(() => api.attach(id, form()))}><Upload />Upload</Button>
                </CardContent>
              </Card>
            )}

            {isOwner && (can('EDIT') || can('CANCEL')) && (
              <div className="flex flex-wrap gap-2.5">
                {can('EDIT') && <Button asChild variant="outline"><Link to={`/leaves/${id}/edit`}><Pencil />Edit request</Link></Button>}
                {can('CANCEL') && <Button variant="outline" className="text-destructive" disabled={busy} onClick={() => run(() => api.act(id, 'cancel'))}>Cancel request</Button>}
              </div>
            )}
          </div>
        )}
        {!hasSidePanel && error && <ErrorBox error={error} className="mt-6" />}
      </div>
    </article>
  );
}
