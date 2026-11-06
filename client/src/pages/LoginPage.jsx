import { useState } from 'react';
import { useAuth } from '../auth.jsx';
import { ErrorBox, FieldError } from '../components.jsx';

const PASSWORD = 'Password@123';
const DEMO_GROUPS = [
  ['HOD', [['Priya Nair', 'priya.nair']]],
  ['Managers', [['Rahul Mehta', 'rahul.mehta'], ['Ananya Iyer', 'ananya.iyer']]],
  ['Employees', [
    ['Arjun Sharma', 'arjun.sharma'], ['Kavya Reddy', 'kavya.reddy'], ['Rohan Das', 'rohan.das'],
    ['Sneha Kulkarni', 'sneha.kulkarni'], ['Imran Khan', 'imran.khan'], ['Meera Joshi', 'meera.joshi'],
  ]],
];

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const signIn = async (mail, pass) => {
    setBusy(true);
    setError(null);
    try {
      await login(mail, pass);
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
      <ErrorBox error={error} />
      <form onSubmit={(e) => { e.preventDefault(); signIn(email, password); }} noValidate>
        <h2>Sign in with your account</h2>
        <label htmlFor="email">Email</label>
        <input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        <FieldError msg={error?.fields?.email} />
        <label htmlFor="password">Password</label>
        <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <FieldError msg={error?.fields?.password} />
        <button className="primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <section className="demo" aria-labelledby="demo-title">
        <h2 id="demo-title">Or sign in with a demo account</h2>
        <p className="muted">One click, no password needed.</p>
        {DEMO_GROUPS.map(([group, people]) => (
          <div key={group}>
            <h3>{group}</h3>
            <div className="demo-grid">
              {people.map(([name, slug]) => (
                <button key={slug} type="button" className="secondary" disabled={busy} onClick={() => signIn(`${slug}@akasa.demo`, PASSWORD)}>
                  {name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
