import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CircleCheck, CircleAlert } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Button } from '../ui/button.jsx';
import { AuthShell } from './AuthShell.jsx';

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const { user } = useAuth() ?? {};
  const [state, setState] = useState(token ? 'checking' : 'failed');

  useEffect(() => {
    if (!token) return undefined;
    let live = true;
    api
      .verifyEmail(token)
      .then(() => live && setState('done'))
      .catch(() => live && setState('failed'));
    return () => {
      live = false;
    };
  }, [token]);

  const next = user ? { to: '/', label: 'Go to Layover' } : { to: '/login', label: 'Sign in' };

  return (
    <AuthShell
      panel="verify"
      kicker="Email"
      title={state === 'checking' ? 'One moment' : state === 'done' ? 'Email confirmed' : 'We could not confirm that link'}
      back={false}
    >
      {state === 'checking' && (
        <p role="status" className="text-muted-foreground">
          Confirming your email address.
        </p>
      )}
      {state === 'done' && (
        <div className="space-y-4">
          <CircleCheck className="size-8 text-status-green-fg" aria-hidden="true" />
          <p role="status">Thanks, your address is confirmed. You can sign in now.</p>
          <Button asChild variant="brand" size="lg" className="w-full">
            <Link to={next.to}>{next.label}</Link>
          </Button>
        </div>
      )}
      {state === 'failed' && (
        <div className="space-y-4">
          <CircleAlert className="size-8 text-status-red-fg" aria-hidden="true" />
          <p role="alert">
            This link has expired or was already used. If you have not signed in yet, try signing in and we will offer to send a new one.
          </p>
          <Button asChild variant="brand">
            <Link to={next.to}>{user ? 'Go to Layover' : 'Go to sign in'}</Link>
          </Button>
        </div>
      )}
    </AuthShell>
  );
}
