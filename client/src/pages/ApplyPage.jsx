import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CalendarDays, Check, FileText, Send, ShieldCheck } from 'lucide-react';
import {
  MAX_FILES, MAX_FILE_BYTES, ALLOWED_MIME, countLeaveDays, isLongLeave, leaveInputSchema,
  documentRequirementError, zodFields, LONG_LEAVE_THRESHOLD_DAYS, todayISO,
} from '@lms/shared';
import { api } from '../api.js';
import { ErrorBox, FieldError, Notice, PageHeader, fmtDate } from '../components.jsx';
import { useAuth } from '../auth.jsx';
import { Button } from '../ui/button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card.jsx';
import { Input, Label, Textarea } from '../ui/input.jsx';
import { cn } from '../lib/utils.js';

function Step({ done, children, muted }) {
  return (
    <li className={cn('flex items-start gap-3', muted && 'text-muted-foreground')}>
      <span className={cn('mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border', done ? 'border-brand bg-brand text-brand-foreground' : 'border-input')}>
        {done && <Check className="size-3" aria-hidden="true" />}
      </span>
      <span className="text-sm">{children}</span>
    </li>
  );
}

export default function ApplyPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ fromDate: todayISO(), toDate: todayISO(), reason: '', isEmergency: false });
  const [files, setFiles] = useState([]);
  const [existingDocs, setExistingDocs] = useState(0);
  const [fields, setFields] = useState({});
  const [error, setError] = useState(null);
  const [obligations, setObligations] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.obligations().then(setObligations).catch(() => {});
    if (editing) {
      api.get(id).then((l) => {
        setForm({ fromDate: l.fromDate, toDate: l.toDate, reason: l.reason, isEmergency: l.isEmergency });
        setExistingDocs(l.documents.length);
      }).catch(setError);
    }
  }, [id, editing]);

  const days = countLeaveDays(form.fromDate, form.toDate);
  const long = isLongLeave(days);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const blockMsg = obligations && !editing ? (form.isEmergency ? !obligations.canApplyEmergency : !obligations.canApplyNormal) && obligations.message : null;
  const needsDocs = long && !form.isEmergency;
  const docCount = existingDocs + files.length;

  const validate = () => {
    const out = {};
    const parsed = leaveInputSchema.safeParse({ ...form, employeeName: user.name });
    if (!parsed.success) Object.assign(out, zodFields(parsed.error));
    else {
      const docMsg = documentRequirementError(days, docCount, form.isEmergency);
      if (docMsg) out.documents = docMsg;
    }
    for (const f of files) {
      if (!ALLOWED_MIME.includes(f.type)) out.documents = `"${f.name}" is not a PDF, JPG or PNG file.`;
      else if (f.size > MAX_FILE_BYTES) out.documents = `"${f.name}" is larger than 5 MB.`;
    }
    if (docCount > MAX_FILES) out.documents = `You can attach at most ${MAX_FILES} documents.`;
    return out;
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    const problems = validate();
    setFields(problems);
    if (Object.keys(problems).length) return;
    const body = new FormData();
    body.append('employeeName', user.name);
    body.append('fromDate', form.fromDate);
    body.append('toDate', form.toDate);
    body.append('reason', form.reason);
    body.append('isEmergency', String(form.isEmergency));
    files.forEach((f) => body.append('documents', f));
    setBusy(true);
    try {
      const saved = editing ? await api.update(id, body) : await api.create(body);
      navigate(`/leaves/${saved.id}`);
    } catch (err) {
      setError(err);
      setFields(err.fields ?? {});
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <PageHeader
        title={editing ? 'Edit leave request' : 'Apply for leave'}
        description="Pick your dates and say why. We count the days for you, and tell you straight away what the request needs."
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
        <Card>
          <form onSubmit={submit} noValidate className="space-y-5 p-5 sm:p-7">
            {blockMsg && <ErrorBox error={{ message: blockMsg }} />}
            {obligations?.owed?.length > 0 && (
              <Notice>Documents still owed for emergency leave: {obligations.owed.map((o) => `${o.fromDate} to ${o.toDate} (due ${o.dueBy})`).join('; ')}. Open the request to upload them.</Notice>
            )}
            <ErrorBox error={error} />
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Label htmlFor="fromDate">From</Label>
                <Input id="fromDate" type="date" value={form.fromDate} min={todayISO()} onChange={set('fromDate')} aria-invalid={Boolean(fields.fromDate)} />
                <FieldError msg={fields.fromDate} />
              </div>
              <div>
                <Label htmlFor="toDate">To</Label>
                <Input id="toDate" type="date" value={form.toDate} min={form.fromDate > todayISO() ? form.fromDate : todayISO()} onChange={set('toDate')} aria-invalid={Boolean(fields.toDate)} />
                <FieldError msg={fields.toDate} />
              </div>
            </div>
            <div>
              <Label htmlFor="reason">Reason</Label>
              <Textarea id="reason" rows={3} value={form.reason} onChange={set('reason')} placeholder="For example: cousin's wedding in Jaipur" aria-invalid={Boolean(fields.reason)} />
              <FieldError msg={fields.reason} />
            </div>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 hover:bg-accent/50">
              <input type="checkbox" checked={form.isEmergency} onChange={set('isEmergency')} className="mt-0.5 size-5 shrink-0 accent-[hsl(var(--brand))]" />
              <span>
                <span className="block font-medium">This is an emergency</span>
                <span className="block text-sm text-muted-foreground">Documents can be sent later, before you return to work or apply for other leave.</span>
              </span>
            </label>
            <div>
              <Label htmlFor="docs">Supporting documents{needsDocs ? ' (required)' : ' (optional)'}</Label>
              <Input id="docs" type="file" multiple accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setFiles([...e.target.files])} aria-invalid={Boolean(fields.documents)} className="h-auto py-2" />
              <p className="mt-1.5 text-sm text-muted-foreground">PDF, JPG or PNG, up to 5 MB each, at most {MAX_FILES} files.</p>
              {editing && existingDocs > 0 && <p className="mt-1 text-sm text-muted-foreground">{existingDocs} document(s) already attached.</p>}
              <FieldError msg={fields.documents} />
            </div>
            <Button variant="brand" size="lg" disabled={busy || Boolean(blockMsg)} className="w-full sm:w-auto">
              <Send />{busy ? 'Saving…' : editing ? 'Save changes' : 'Submit request'}
            </Button>
          </form>
        </Card>

        <aside aria-label="Summary" className="lg:sticky lg:top-24">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle as="h2" className="flex items-center gap-2 text-base"><CalendarDays className="size-4 text-brand" aria-hidden="true" />Your request</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div aria-live="polite">
                <p className="font-display text-6xl leading-none">{days > 0 ? days : '–'}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {days > 0 ? `leave day${days > 1 ? 's' : ''}, ${fmtDate(form.fromDate)} to ${fmtDate(form.toDate)}` : 'Pick valid dates'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Sundays are never counted as leave.</p>
              </div>
              <div>
                <h3 className="mb-2.5 flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="size-4 text-brand" aria-hidden="true" />What happens next</h3>
                <ol className="space-y-2.5">
                  <Step done>You submit the request</Step>
                  <Step done={false}>{user.role === 'EMPLOYEE' ? 'Your manager reviews it' : 'The HOD reviews it'}</Step>
                  {long && user.role === 'EMPLOYEE' && <Step done={false}>The HOD gives final approval, because it is longer than {LONG_LEAVE_THRESHOLD_DAYS} days</Step>}
                  {!long && days > 0 && <Step muted done={false}>No second approval needed (up to {LONG_LEAVE_THRESHOLD_DAYS} days)</Step>}
                </ol>
              </div>
              <div>
                <h3 className="mb-2.5 flex items-center gap-2 text-sm font-semibold"><FileText className="size-4 text-brand" aria-hidden="true" />Documents</h3>
                {needsDocs && <p className="text-sm">A supporting document is required for leave over {LONG_LEAVE_THRESHOLD_DAYS} days{docCount > 0 ? ` and you have attached ${docCount}.` : ', for example a medical certificate or travel booking.'}</p>}
                {long && form.isEmergency && <p className="text-sm">Emergency: you can submit now and send documents afterwards. The usual approvals still apply.</p>}
                {!long && <p className="text-sm text-muted-foreground">Not required for this length of leave.</p>}
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </section>
  );
}
