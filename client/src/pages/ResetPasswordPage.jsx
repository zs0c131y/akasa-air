import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CircleCheck } from 'lucide-react';
import { passwordProblem } from '@lms/shared';
import { api } from '../api.js';
import { ErrorBox } from '../components.jsx';
import { Button } from '../ui/button.jsx';
import { AuthShell, PasswordField } from './AuthShell.jsx';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [state, setState] = useState('checking'); // checking | ok | expired | done
  const [password, setPassword] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    if (!token) {
      setState('expired');
      return undefined;
    }
    api
      .checkReset(token)
      .then((r) => live && setState(r.valid ? 'ok' : 'expired'))
      .catch((err) => {
        if (live) {
          setError(err);
          setState('expired');
        }
      });
    return () => {
      live = false;
    };
  }, [token]);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    const problem = passwordProblem(password);
    if (problem) {
      setFieldError(problem);
      return;
    }
    setFieldError('');
    setBusy(true);
    try {
      await api.resetPassword(token, password);
      setState('done');
    } catch (err) {
      if (err.code === 'LINK_INVALID') setState('expired');
      else if (err.fields?.password) setFieldError(err.fields.password);
      else setError(err);
    } finally {
      setBusy(false);
    }
  };

  if (state === 'checking') {
    return (
      <AuthShell panel="reset" kicker="Password" title="One moment" back={false}>
        <p role="status" className="text-muted-foreground">
          Checking your link.
        </p>
      </AuthShell>
    );
  }

  if (state === 'expired') {
    return (
      <AuthShell
        panel="reset"
        kicker="Password"
        title="This link has expired"
        intro="Links to choose a new password only work for a short while, and only once."
        back={false}
      >
        {error?.code === 'NETWORK' && <ErrorBox error={error} className="mb-5" />}
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="brand">
            <Link to="/forgot-password">Ask for a new link</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/login">Back to sign in</Link>
          </Button>
        </div>
      </AuthShell>
    );
  }

  if (state === 'done') {
    return (
      <AuthShell panel="reset" kicker="Password" title="Password changed" back={false}>
        <div className="space-y-4">
          <CircleCheck className="size-8 text-status-green-fg" aria-hidden="true" />
          <p role="status">Your new password is saved. Use it the next time you sign in.</p>
          <Button asChild variant="brand" size="lg" className="w-full">
            <Link to="/login">Sign in</Link>
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell panel="reset" kicker="Password" title="Choose a new password" back={false}>
      <ErrorBox error={error} className="mb-5" />
      <form onSubmit={submit} noValidate className="space-y-5">
        <PasswordField
          id="new-password"
          label="New password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldError}
          hint
        />
        <Button variant="brand" className="w-full" size="lg" disabled={busy}>
          {busy ? 'Saving' : 'Save password'}
        </Button>
      </form>
    </AuthShell>
  );
}
