import { useState } from 'react';
import { changePasswordSchema, passwordProblem, zodFields } from '@lms/shared';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Avatar, ErrorBox, PageHeader, Panel } from '../components.jsx';
import { Button } from '../ui/button.jsx';
import { PasswordField } from './AuthShell.jsx';

const ROLE = { HOD: 'Head of Department', MANAGER: 'Manager', EMPLOYEE: 'Employee' };

export default function AccountPage() {
  const { user } = useAuth();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '' });
  const [fields, setFields] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const parsed = changePasswordSchema.safeParse(form);
    const out = parsed.success ? {} : zodFields(parsed.error);
    if (!out.newPassword) {
      const problem = passwordProblem(form.newPassword, { email: user.email, name: user.name });
      if (problem) out.newPassword = problem;
    }
    setFields(out);
    if (Object.keys(out).length) return;
    setBusy(true);
    try {
      await api.changePassword(form.currentPassword, form.newPassword);
      setForm({ currentPassword: '', newPassword: '' });
      setSaved(true);
    } catch (err) {
      const f = { ...(err.fields ?? {}) };
      if (err.code === 'WRONG_PASSWORD' && !f.currentPassword) f.currentPassword = err.message;
      setFields(f);
      setError(Object.keys(f).length ? null : err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <PageHeader kicker="Your account" title="Account" description="Who you are in Layover, and where you can change your password." />
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <Panel title="About you">
          <div className="flex items-center gap-4">
            <Avatar name={user.name} className="size-14" />
            <div className="min-w-0">
              <p className="font-display text-xl leading-tight">{user.name}</p>
              {user.email && <p className="truncate text-sm text-muted-foreground">{user.email}</p>}
            </div>
          </div>
          <dl className="mt-6 grid gap-5 border-t pt-5 sm:grid-cols-2">
            <div><dt className="kicker">Role</dt><dd className="mt-1.5 font-semibold">{ROLE[user.role]}</dd></div>
            <div>
              <dt className="kicker">Location</dt>
              <dd className="mt-1.5 font-semibold">{user.location || 'Not set yet'}</dd>
              {!user.location && <dd className="mt-1 text-sm text-muted-foreground">The Head of Department sets this. It decides which local holidays apply to you.</dd>}
            </div>
          </dl>
        </Panel>

        <Panel title="Change your password">
          <ErrorBox error={error} className="mb-5" />
          {saved && <p role="status" className="mb-5 rounded-lg border border-status-green-fg/30 bg-status-green-bg p-4 text-sm font-semibold text-status-green-fg">Your password is changed.</p>}
          <form onSubmit={submit} noValidate className="space-y-5">
            <input type="text" name="username" autoComplete="username" value={user.email ?? ''} readOnly hidden />
            <PasswordField id="current-password" label="Current password" autoComplete="current-password" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} error={fields.currentPassword} />
            <PasswordField id="new-password" label="New password" autoComplete="new-password" value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} error={fields.newPassword} hint context={{ email: user.email, name: user.name }} />
            <Button variant="brand" size="lg" disabled={busy}>{busy ? 'Saving' : 'Change password'}</Button>
          </form>
        </Panel>
      </div>
    </section>
  );
}
