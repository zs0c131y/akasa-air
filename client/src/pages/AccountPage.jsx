import { useState } from 'react';
import { changePasswordSchema, passwordProblem, zodFields } from '@lms/shared';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Avatar, ErrorBox, PageHeader, Panel } from '../components.jsx';
import { BalanceBar, days } from '../balance.jsx';
import { Badge } from '../ui/badge.jsx';
import { Button } from '../ui/button.jsx';
import { cn } from '../lib/utils.js';
import { PasswordField } from './AuthShell.jsx';

const ROLE = { HOD: 'Head of Department', MANAGER: 'Manager', EMPLOYEE: 'Employee' };

const memberSince = (d) =>
  d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : 'Not recorded';

function Detail({ label, children, note }) {
  return (
    <div className="min-w-0">
      <dt className="kicker">{label}</dt>
      <dd className="mt-1.5 break-words font-semibold">{children}</dd>
      {note && <dd className="mt-1 text-sm text-muted-foreground">{note}</dd>}
    </div>
  );
}

function EmailPreference({ user, refresh }) {
  const [on, setOn] = useState(user.emailNotifications);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    const next = !on;
    setBusy(true);
    setError(null);
    setOn(next);
    try {
      await api.setPreferences({ emailNotifications: next });
      await refresh?.();
    } catch (err) {
      setOn(!next);
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Panel title="Notifications">
      <ErrorBox error={error} className="mb-4" />
      <div className="flex items-start gap-4">
        <button
          type="button"
          role="switch"
          id="email-pref"
          aria-checked={on}
          aria-labelledby="email-pref-label"
          aria-describedby="email-pref-note"
          disabled={busy}
          onClick={toggle}
          className="relative mt-0.5 inline-flex h-11 w-14 shrink-0 items-center justify-center rounded-full"
        >
          <span
            aria-hidden="true"
            className={cn(
              'relative block h-7 w-12 rounded-full border transition-colors',
              on ? 'border-brand bg-brand' : 'border-input bg-secondary',
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 size-5 rounded-full bg-white shadow-soft transition-all',
                on ? 'left-6' : 'left-0.5 bg-foreground',
              )}
            />
          </span>
        </button>
        <div>
          <label id="email-pref-label" htmlFor="email-pref" className="block cursor-pointer font-semibold">
            Email me when something changes on my requests
          </label>
          <p id="email-pref-note" className="mt-1 text-sm text-muted-foreground">
            Notices in Layover (the bell at the top) always stay on. This only controls email, which is currently {on ? 'on' : 'off'}.
          </p>
        </div>
      </div>
    </Panel>
  );
}

export default function AccountPage() {
  const { user, refresh } = useAuth();
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
      <PageHeader
        kicker="Your account"
        title="Account"
        description="Your details, your leave balance, how we reach you, and your password."
      />
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <Panel title="Your details" className="lg:col-span-2">
          <div className="flex items-center gap-4">
            <Avatar name={user.name} className="size-16" />
            <div className="min-w-0">
              <p className="font-display text-2xl leading-tight">{user.name}</p>
              <p className="text-sm text-muted-foreground">{ROLE[user.role]}</p>
            </div>
          </div>
          <dl className="mt-6 grid gap-5 border-t pt-5 sm:grid-cols-2 lg:grid-cols-3">
            <Detail label="Employee ID">
              <span className="font-mono">{user.employeeCode}</span>
            </Detail>
            <Detail label="Email">
              <span className="break-all">{user.email}</span>{' '}
              <Badge variant={user.emailVerified ? 'green' : 'amber'} className="align-middle">
                {user.emailVerified ? 'Confirmed' : 'Not confirmed yet'}
              </Badge>
            </Detail>
            <Detail label="Department">{user.department || 'Not set'}</Detail>
            <Detail label="Location" note={user.location ? undefined : 'The HOD sets this. It decides which local holidays apply to you.'}>
              {user.location || 'Not set yet, the HOD sets this'}
            </Detail>
            <Detail label="Manager">
              {user.managerName ||
                (user.role === 'EMPLOYEE'
                  ? 'Waiting for the HOD to choose'
                  : user.role === 'MANAGER'
                    ? 'The Head of Department'
                    : 'None, you lead the department')}
            </Detail>
            <Detail label="Member since">{memberSince(user.joinedAt)}</Detail>
          </dl>
        </Panel>

        {user.balance && (
          <Panel title="Leave balance" kicker={String(user.balance.year)}>
            <BalanceBar balance={user.balance} />
            <p className="mt-5 text-sm">Your allowance this year is {days(user.balance.allowance)}.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {user.balance.custom
                ? 'The Head of Department set this number for you.'
                : 'This is the same number everyone gets. The Head of Department has not set a different one for you.'}
            </p>
          </Panel>
        )}

        <EmailPreference user={user} refresh={refresh} />

        <Panel title="Change your password">
          <ErrorBox error={error} className="mb-5" />
          {saved && (
            <p
              role="status"
              className="mb-5 rounded-lg border border-status-green-fg/30 bg-status-green-bg p-4 text-sm font-semibold text-status-green-fg"
            >
              Your password is changed.
            </p>
          )}
          <form onSubmit={submit} noValidate className="space-y-5">
            <input type="text" name="username" autoComplete="username" value={user.email ?? ''} readOnly hidden />
            <PasswordField
              id="current-password"
              label="Current password"
              autoComplete="current-password"
              value={form.currentPassword}
              onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
              error={fields.currentPassword}
            />
            <PasswordField
              id="new-password"
              label="New password"
              autoComplete="new-password"
              value={form.newPassword}
              onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
              error={fields.newPassword}
              hint
              context={{ email: user.email, name: user.name }}
            />
            <Button variant="brand" size="lg" disabled={busy}>
              {busy ? 'Saving' : 'Change password'}
            </Button>
          </form>
        </Panel>
      </div>
    </section>
  );
}
