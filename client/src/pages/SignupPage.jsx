import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CircleCheck, MailCheck } from 'lucide-react';
import { signupSchema, zodFields } from '@lms/shared';
import { api } from '../api.js';
import { ErrorBox, FieldError } from '../components.jsx';
import { Button } from '../ui/button.jsx';
import { Input, Label } from '../ui/input.jsx';
import { AuthShell, PasswordField } from './AuthShell.jsx';

export default function SignupPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [fields, setFields] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [resent, setResent] = useState('');

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    const parsed = signupSchema.safeParse(form);
    if (!parsed.success) {
      setFields(zodFields(parsed.error));
      return;
    }
    setFields({});
    setBusy(true);
    try {
      setDone(await api.signup(parsed.data));
    } catch (err) {
      setFields(err.fields ?? {});
      setError(Object.keys(err.fields ?? {}).length ? null : err);
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setResent('');
    try {
      const r = await api.resendVerification(form.email);
      setResent(r.message || 'If that address has an account waiting, we have sent the link again.');
    } catch (err) {
      setError(err);
    }
  };

  if (done) {
    return (
      <AuthShell
        panel="signup"
        kicker="Create an account"
        title={done.needsVerification ? 'Check your email' : 'Your account is ready'}
        back={false}
      >
        {done.needsVerification ? (
          <div className="space-y-4">
            <MailCheck className="size-8 text-brand" aria-hidden="true" />
            <p>
              We sent a link to <strong className="font-semibold">{form.email}</strong>. Open it to confirm your address, then sign in.
            </p>
            <p className="text-sm text-muted-foreground">
              Nothing there after a few minutes? Look in your spam folder, or ask for a new link.
            </p>
            <ErrorBox error={error} />
            {resent && (
              <p role="status" className="text-sm font-medium text-status-green-fg">
                {resent}
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" type="button" onClick={resend}>
                Send it again
              </Button>
              <Button asChild variant="brand">
                <Link to="/login">Go to sign in</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <CircleCheck className="size-8 text-status-green-fg" aria-hidden="true" />
            <p>{done.message || 'Your account has been created.'}</p>
            <p className="text-sm text-muted-foreground">
              Before you can apply for leave, the Head of Department needs to choose your manager. You can sign in now and look around while
              you wait.
            </p>
            <Button asChild variant="brand" size="lg" className="w-full">
              <Link to="/login">Sign in</Link>
            </Button>
          </div>
        )}
      </AuthShell>
    );
  }

  return (
    <AuthShell
      panel="signup"
      kicker="Create an account"
      title="Join Layover"
      intro="Use your work email. The Head of Department will set you up with a manager before you apply."
    >
      <ErrorBox error={error} className="mb-5" />
      <form onSubmit={submit} noValidate className="space-y-5">
        <div>
          <Label htmlFor="name">Full name</Label>
          <Input id="name" autoComplete="name" value={form.name} onChange={set('name')} aria-invalid={Boolean(fields.name)} />
          <FieldError msg={fields.name} />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={set('email')}
            aria-invalid={Boolean(fields.email)}
          />
          <FieldError msg={fields.email} />
        </div>
        <PasswordField
          id="password"
          label="Choose a password"
          autoComplete="new-password"
          value={form.password}
          onChange={set('password')}
          error={fields.password}
          hint
          context={{ email: form.email, name: form.name }}
        />
        <Button variant="brand" className="w-full" size="lg" disabled={busy}>
          {busy ? 'Creating your account' : 'Create account'}
        </Button>
      </form>
      <p className="mt-5 text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-foreground underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
