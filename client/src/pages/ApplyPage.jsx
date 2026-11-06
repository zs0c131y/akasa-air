import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Send } from 'lucide-react';
import {
  MAX_FILES,
  MAX_FILE_BYTES,
  ALLOWED_MIME,
  leaveBreakdown,
  absenceDays,
  isLongLeave,
  makeLeaveInputSchema,
  documentRequirementError,
  excludedSummary,
  zodFields,
  LONG_LEAVE_THRESHOLD_DAYS,
  todayISO,
} from '@lms/shared';
import { api } from '../api.js';
import { Avatar, ErrorBox, FieldError, Notice, PageHeader, Panel, fmtDate } from '../components.jsx';
import { useAuth } from '../auth.jsx';
import { Button } from '../ui/button.jsx';
import { Input, Label, Textarea } from '../ui/input.jsx';

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
  const [holidays, setHolidays] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .obligations()
      .then(setObligations)
      .catch(() => {});
    api
      .holidays()
      .then((r) => setHolidays(r.items))
      .catch(() => {});
    if (editing) {
      api
        .get(id)
        .then((l) => {
          setForm({ fromDate: l.fromDate, toDate: l.toDate, reason: l.reason, isEmergency: l.isEmergency });
          setExistingDocs(l.documents.length);
        })
        .catch(setError);
    }
  }, [id, editing]);

  // Leave left for the year the request starts in.
  const [balance, setBalance] = useState(null);
  const year = form.fromDate ? Number(form.fromDate.slice(0, 4)) : null;
  useEffect(() => {
    if (!year) return undefined;
    let live = true;
    api
      .balance(year)
      .then((b) => {
        if (live) setBalance(b);
      })
      .catch(() => {
        if (live) setBalance(null);
      });
    return () => {
      live = false;
    };
  }, [year]);

  const count = useMemo(() => leaveBreakdown(form.fromDate, form.toDate, holidays), [form.fromDate, form.toDate, holidays]);
  const days = count.days;
  // Other leave that touches these dates counts as one stretch (asked of the server, which knows the person's other requests).
  const [chain, setChain] = useState(null);
  useEffect(() => {
    setChain(null);
    if (!(days > 0)) return undefined;
    const t = setTimeout(() => {
      api
        .chain(form.fromDate, form.toDate, id)
        .then(setChain)
        .catch(() => setChain(null));
    }, 250);
    return () => clearTimeout(t);
  }, [form.fromDate, form.toDate, days, id]);
  const ownAway = absenceDays(form.fromDate, form.toDate);
  const stretch = chain && chain.absenceDays > ownAway ? chain : null;
  const effectiveDays = Math.max(ownAway, chain?.absenceDays ?? 0);
  const long = isLongLeave(effectiveDays);
  const schema = useMemo(() => makeLeaveInputSchema(holidays), [holidays]);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const blockMsg =
    obligations && !editing
      ? (form.isEmergency ? !obligations.canApplyEmergency : !obligations.canApplyNormal) && obligations.message
      : null;
  const needsDocs = long && !form.isEmergency;
  const docCount = existingDocs + (long ? files.length : 0);
  const inBetween = [
    count.sundays ? `${count.sundays} Sunday${count.sundays === 1 ? '' : 's'}` : '',
    count.holidays.length ? `${count.holidays.length} holiday${count.holidays.length === 1 ? '' : 's'}` : '',
  ]
    .filter(Boolean)
    .join(' and ');
  const note = excludedSummary({ sundays: count.sundays, holidays: count.holidays });

  // Leave that is not long needs no documents: drop anything picked earlier.
  useEffect(() => {
    if (!long && files.length) setFiles([]);
  }, [long, files.length]);

  const validate = () => {
    const out = {};
    const parsed = schema.safeParse({ ...form, employeeName: user.name });
    if (!parsed.success) Object.assign(out, zodFields(parsed.error));
    else {
      const docMsg = documentRequirementError(effectiveDays, docCount, form.isEmergency);
      if (docMsg) out.documents = docMsg;
    }
    if (long) {
      for (const f of files) {
        if (!ALLOWED_MIME.includes(f.type)) out.documents = `"${f.name}" is not a PDF, JPG or PNG file.`;
        else if (f.size > MAX_FILE_BYTES) out.documents = `"${f.name}" is larger than 5 MB.`;
      }
      if (docCount > MAX_FILES) out.documents = `You can attach at most ${MAX_FILES} documents.`;
    }
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
    if (long) files.forEach((f) => body.append('documents', f));
    setBusy(true);
    try {
      const saved = editing ? await api.update(id, body) : await api.create(body);
      navigate(`/leaves/${saved.id}`);
    } catch (err) {
      setError(err);
      setFields(
        err.code === 'NOT_ENOUGH_LEAVE'
          ? { ...(err.fields ?? {}), toDate: 'This is more than the leave you have left.' }
          : (err.fields ?? {}),
      );
    } finally {
      setBusy(false);
    }
  };
  const overBalance = balance && !editing && days > balance.remaining;

  const approvalSteps =
    user.role === 'HOD'
      ? 'You are the Head of Department, so your own leave is approved as soon as you file it.'
      : user.role === 'MANAGER'
        ? 'The HOD reviews it.'
        : long
          ? 'Your manager reviews it first, then the HOD gives the final yes.'
          : 'Your manager reviews it. Leave of up to 3 days in a row needs no one else.';
  const docsText = !long
    ? 'Not needed. Documents are only taken for leave of more than 3 days in a row.'
    : form.isEmergency
      ? 'Can follow. Send them before you return to work or ask for other leave.'
      : 'Needed. Attach at least one before you submit.';
  const sentence =
    days > 0
      ? note
        ? `${note}.`
        : 'No Sundays or public holidays fall in these dates.'
      : count.calendarDays > 0
        ? 'These dates are only Sundays or public holidays, which are never counted. Add a working day.'
        : 'Pick a start and end date to see the count.';

  return (
    <section>
      <PageHeader
        kicker={editing ? 'Change a request' : 'New request'}
        title={editing ? 'Edit leave request' : 'Apply for leave'}
        description="Pick your dates and give a reason. The summary on the right updates as you type and shows what will be filed."
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
        <form onSubmit={submit} noValidate className="space-y-6 rounded-lg border bg-card p-5 shadow-soft sm:p-6">
          {blockMsg && <ErrorBox error={{ message: blockMsg }} />}
          {obligations?.owed?.length > 0 && (
            <Notice>
              You still owe documents for emergency leave:{' '}
              {obligations.owed.map((o) => `${o.fromDate} to ${o.toDate} (due ${o.dueBy})`).join('; ')}. Open that request to upload them.
            </Notice>
          )}
          {stretch && (
            <Notice>
              This joins up with your other leave ({stretch.members.map((m) => `${fmtDate(m.fromDate)} to ${fmtDate(m.toDate)}`).join(', ')}
              ), so together it is {stretch.absenceDays} days in a row. Leave of more than 3 days in a row needs a document and the HOD's
              approval.
            </Notice>
          )}
          {error?.code === 'NO_MANAGER' || error?.code === 'NOT_ENOUGH_LEAVE' ? (
            <Notice>
              {error.message} {error.hint}
            </Notice>
          ) : (
            <ErrorBox error={error} />
          )}
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="fromDate">From</Label>
              <Input
                id="fromDate"
                type="date"
                value={form.fromDate}
                min={todayISO()}
                onChange={set('fromDate')}
                aria-invalid={Boolean(fields.fromDate)}
              />
              <FieldError msg={fields.fromDate} />
            </div>
            <div>
              <Label htmlFor="toDate">To</Label>
              <Input
                id="toDate"
                type="date"
                value={form.toDate}
                min={form.fromDate > todayISO() ? form.fromDate : todayISO()}
                onChange={set('toDate')}
                aria-invalid={Boolean(fields.toDate)}
              />
              <FieldError msg={fields.toDate} />
            </div>
          </div>
          <div>
            <Label htmlFor="reason">Reason</Label>
            <Textarea
              id="reason"
              rows={3}
              value={form.reason}
              onChange={set('reason')}
              placeholder="For example: cousin's wedding in Jaipur"
              aria-invalid={Boolean(fields.reason)}
            />
            <FieldError msg={fields.reason} />
          </div>
          {long && (
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border bg-background p-4 transition-colors hover:bg-accent/50">
              <input
                type="checkbox"
                checked={form.isEmergency}
                onChange={set('isEmergency')}
                className="mt-0.5 size-5 shrink-0 accent-[hsl(var(--brand))]"
              />
              <span>
                <span className="block font-semibold">This is an emergency</span>
                <span className="block text-sm text-muted-foreground">
                  You can file now and send the documents later, before you return to work or ask for other leave.
                </span>
              </span>
            </label>
          )}
          {long && (
            <div>
              <Label htmlFor="docs">Supporting documents{needsDocs ? ' (required)' : ' (can follow)'}</Label>
              <Input
                id="docs"
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setFiles([...e.target.files])}
                aria-invalid={Boolean(fields.documents)}
                className="h-auto py-2"
              />
              <p className="mt-1.5 text-sm text-muted-foreground">
                PDF, JPG or PNG, up to 5 MB each, at most {MAX_FILES} files. Leave of more than {LONG_LEAVE_THRESHOLD_DAYS} days in a row
                needs a document, such as a medical certificate or a travel booking.
              </p>
              {editing && existingDocs > 0 && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {existingDocs} document{existingDocs === 1 ? ' is' : 's are'} already attached.
                </p>
              )}
              <FieldError msg={fields.documents} />
            </div>
          )}
          <Button variant="brand" size="lg" disabled={busy || Boolean(blockMsg)} className="w-full sm:w-auto">
            <Send />
            {busy ? 'Saving' : editing ? 'Save changes' : 'Submit request'}
          </Button>
        </form>

        <aside aria-label="Summary of your request" className="lg:sticky lg:top-36">
          <Panel as="div" className="space-y-5">
            <div className="flex items-center gap-3">
              <Avatar name={user.name} className="size-11" />
              <div className="min-w-0">
                <p className="kicker">Summary</p>
                <p className="truncate font-semibold">{user.name}</p>
              </div>
            </div>
            <div aria-live="polite" className="border-t pt-5">
              <p className="kicker">Counted as leave</p>
              <p className="mt-1.5">
                <span className="num font-display text-6xl leading-none">{days}</span>
                <span className="ml-2 text-base font-medium">day{days === 1 ? '' : 's'}</span>
              </p>
              {ownAway !== days && days > 0 && (
                <p className="mt-2 text-sm font-medium">
                  {days} leave day{days === 1 ? '' : 's'}, {ownAway} days away in a row ({inBetween} in between{' '}
                  {count.sundays + count.holidays.length === 1 ? 'is' : 'are'} not charged)
                </p>
              )}
              <p className="mt-2 font-mono text-sm">
                {days > 0 || count.calendarDays > 0 ? `${fmtDate(form.fromDate)} to ${fmtDate(form.toDate)}` : ''}
              </p>
              <p className="mt-1.5 text-sm text-muted-foreground">{sentence}</p>
            </div>
            <div aria-live="polite" className="border-t pt-5 text-sm">
              <p className="kicker">Leave left{balance ? ` in ${balance.year}` : ''}</p>
              {balance ? (
                <>
                  <p className="mt-1.5">
                    <span className="num font-display text-2xl">
                      {balance.remaining} of {balance.allowance}
                    </span>{' '}
                    days left this year
                  </p>
                  {balance.pending > 0 && (
                    <p className="mt-1 text-muted-foreground">
                      {balance.pending} more {balance.pending === 1 ? 'day is' : 'days are'} waiting for an answer.
                    </p>
                  )}
                  {overBalance && (
                    <p className="mt-2 rounded-md bg-status-amber-bg p-2.5 font-medium text-status-amber-fg">
                      This request is {days} {days === 1 ? 'day' : 'days'}, and you have {Math.max(balance.remaining, 0)} left. It will not
                      go through unless the Head of Department raises your allowance first.
                    </p>
                  )}
                </>
              ) : (
                <p className="mt-1.5 text-muted-foreground">Checking</p>
              )}
            </div>
            <dl className="space-y-4 border-t pt-5 text-sm">
              <div>
                <dt className="kicker">What happens next</dt>
                <dd className="mt-1.5">{approvalSteps}</dd>
              </div>
              <div>
                <dt className="kicker">Documents</dt>
                <dd className="mt-1.5">{docsText}</dd>
              </div>
            </dl>
          </Panel>
        </aside>
      </div>
    </section>
  );
}
