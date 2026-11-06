import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import { forgotSchema, zodFields } from '@lms/shared';
import { api } from '../api.js';
import { ErrorBox, FieldError } from '../components.jsx';
import { Button } from '../ui/button.jsx';
import { Input, Label } from '../ui/input.jsx';
import { AuthShell } from './AuthShell.jsx';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [fields, setFields] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    const parsed = forgotSchema.safeParse({ email });
    if (!parsed.success) {
      setFields(zodFields(parsed.error));
      return;
    }
    setFields({});
    setBusy(true);
    try {
      const r = await api.forgotPassword(parsed.data.email);
      setMessage(r.message || 'If that email has an account, a link to choose a new password is on its way.');
    } catch (err) {
      setFields(err.fields ?? {});
      setError(Object.keys(err.fields ?? {}).length ? null : err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      panel="forgot"
      kicker="Password"
      title="Forgot your password?"
      intro="Give us your email and we will send a link to choose a new one."
    >
      {message ? (
        <div className="space-y-4">
          <MailCheck className="size-8 text-brand" aria-hidden="true" />
          <p role="status">{message}</p>
          <p className="text-sm text-muted-foreground">The link works for a short while. If it does not turn up, check your spam folder.</p>
          <Button asChild variant="outline">
            <Link to="/login">Back to sign in</Link>
          </Button>
        </div>
      ) : (
        <>
          <ErrorBox error={error} className="mb-5" />
          <form onSubmit={submit} noValidate className="space-y-5">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={Boolean(fields.email)}
              />
              <FieldError msg={fields.email} />
            </div>
            <Button variant="brand" className="w-full" size="lg" disabled={busy}>
              {busy ? 'Sending' : 'Send the link'}
            </Button>
          </form>
        </>
      )}
    </AuthShell>
  );
}
