import { useState } from 'react';
import { useAuth } from '../auth.jsx';
import { ErrorBox, FieldError } from '../components.jsx';

const DEMO = [
  ['Employee', 'arjun.sharma@akasa.demo'],
  ['Manager', 'rahul.mehta@akasa.demo'],
  ['HOD', 'priya.nair@akasa.demo'],
];

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="login">
      <h1>Leave Desk</h1>
      <p className="muted">Sign in to apply for leave or review requests.</p>
      <form onSubmit={submit} noValidate>
        <ErrorBox error={error} />
        <label htmlFor="email">Email</label>
        <input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        <FieldError msg={error?.fields?.email} />
        <label htmlFor="password">Password</label>
        <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <FieldError msg={error?.fields?.password} />
        <button className="primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <section className="demo">
        <h2>Demo accounts</h2>
        <p className="muted">Password for all: <code>Password@123</code></p>
        {DEMO.map(([role, mail]) => (
          <button key={mail} type="button" className="secondary" onClick={() => { setEmail(mail); setPassword('Password@123'); }}>
            Fill in {role} ({mail})
          </button>
        ))}
      </section>
    </main>
  );
}
