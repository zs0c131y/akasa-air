import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  MAX_FILES, MAX_FILE_BYTES, ALLOWED_MIME, countLeaveDays, isLongLeave, leaveInputSchema,
  documentRequirementError, zodFields, LONG_LEAVE_THRESHOLD_DAYS, todayISO,
} from '@lms/shared';
import { api } from '../api.js';
import { ErrorBox, FieldError } from '../components.jsx';
import { useAuth } from '../auth.jsx';

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

  const validate = () => {
    const out = {};
    const parsed = leaveInputSchema.safeParse({ ...form, employeeName: user.name });
    if (!parsed.success) Object.assign(out, zodFields(parsed.error));
    else {
      const docMsg = documentRequirementError(days, existingDocs + files.length, form.isEmergency);
      if (docMsg) out.documents = docMsg;
    }
    for (const f of files) {
      if (!ALLOWED_MIME.includes(f.type)) out.documents = `"${f.name}" is not a PDF, JPG or PNG file.`;
      else if (f.size > MAX_FILE_BYTES) out.documents = `"${f.name}" is larger than 5 MB.`;
    }
    if (existingDocs + files.length > MAX_FILES) out.documents = `You can attach at most ${MAX_FILES} documents.`;
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
    <form className="card narrow" onSubmit={submit} noValidate>
      <h1>{editing ? 'Edit leave request' : 'Apply for leave'}</h1>
      {blockMsg && <div className="error" role="alert"><strong>{blockMsg}</strong></div>}
      {obligations?.owed?.length > 0 && (
        <div className="notice">
          Documents still owed for emergency leave: {obligations.owed.map((o) => `${o.fromDate} to ${o.toDate} (due ${o.dueBy})`).join('; ')}. Open the request to upload them.
        </div>
      )}
      <ErrorBox error={error} />
      <div className="row">
        <div>
          <label htmlFor="fromDate">From</label>
          <input id="fromDate" type="date" value={form.fromDate} min={todayISO()} onChange={set('fromDate')} />
          <FieldError msg={fields.fromDate} />
        </div>
        <div>
          <label htmlFor="toDate">To</label>
          <input id="toDate" type="date" value={form.toDate} min={form.fromDate > todayISO() ? form.fromDate : todayISO()} onChange={set('toDate')} />
          <FieldError msg={fields.toDate} />
        </div>
      </div>
      <p className="daycount" aria-live="polite">
        {days > 0 ? `${days} day${days > 1 ? 's' : ''}` : 'Pick valid dates'}
        {long && !form.isEmergency && ` — more than ${LONG_LEAVE_THRESHOLD_DAYS} days: a supporting document is required, and both your manager and the HOD must approve.`}
        {long && form.isEmergency && ' — emergency: documents can follow, but both your manager and the HOD must approve.'}
      </p>
      <label htmlFor="reason">Reason</label>
      <textarea id="reason" rows="3" value={form.reason} onChange={set('reason')} />
      <FieldError msg={fields.reason} />
      <label className="check">
        <input type="checkbox" checked={form.isEmergency} onChange={set('isEmergency')} />
        Emergency leave (documents can be sent later — before you return to work or apply again)
      </label>
      <label htmlFor="docs">
        Supporting documents (PDF, JPG or PNG, up to 5 MB each){long && !form.isEmergency ? ' — required' : ''}
      </label>
      <input id="docs" type="file" multiple accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setFiles([...e.target.files])} />
      {editing && existingDocs > 0 && <p className="muted">{existingDocs} document(s) already attached.</p>}
      <FieldError msg={fields.documents} />
      <button className="primary" disabled={busy || Boolean(blockMsg)}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Submit request'}</button>
    </form>
  );
}
