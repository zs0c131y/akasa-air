import { useState } from 'react';
import { api } from '../api.js';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { Avatar, Brand, ErrorBox, FieldError } from '../components.jsx';
import { ThemeToggle } from '../theme.jsx';
import { Button } from '../ui/button.jsx';
import { Input, Label } from '../ui/input.jsx';

const PASSWORD = 'Password@123';
const DEMO_GROUPS = [
  ['Head of Department', [['Priya Nair', 'priya.nair', 'Gives the final yes on long leave. Sees every request, the audit log and the holiday list.']]],
  ['Managers', [
    ['Rahul Mehta', 'rahul.mehta', 'Has requests from his team waiting for a decision.'],
    ['Ananya Iyer', 'ananya.iyer', 'Has approved some requests and passed others on to the HOD.'],
  ]],
  ['Employees', [
    ['Arjun Sharma', 'arjun.sharma', 'Has two requests waiting on a manager.'],
    ['Kavya Reddy', 'kavya.reddy', 'Was asked for more information and can reply.'],
    ['Rohan Das', 'rohan.das', 'Has long leave waiting on the HOD.'],
    ['Sneha Kulkarni', 'sneha.kulkarni', 'Has one request approved and one at the HOD.'],
    ['Imran Khan', 'imran.khan', 'Filed emergency leave and still owes the documents.'],
    ['Meera Joshi', 'meera.joshi', 'The HOD asked her for a return ticket.'],
  ]],
];

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [resent, setResent] = useState('');

  const signIn = async (mail, pass) => {
    setBusy(true);
    setError(null);
    setResent('');
    try {
      await login(mail, pass);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setResent('');
    try {
      const r = await api.resendVerification(email.trim());
      setResent(r.message || 'If that address is waiting to be confirmed, we have sent the link again.');
    } catch (err) {
      setError(err);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError({ message: 'Enter your email and password to sign in.', hint: 'No account yet? Pick a person from the list below instead.' });
      return;
    }
    signIn(email, password);
  };

  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="rounded-md" aria-label="Layover by Akasa Air, home"><Brand /></Link>
          <ThemeToggle />
        </div>
      </header>
      <main id="content" className="container pb-24 pt-8 sm:pt-12">
        <Link to="/" className="mb-8 inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden="true" /> Back to home
        </Link>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-16">
          <div>
            <p className="kicker mb-2.5">Sign in</p>
            <h1 className="font-display text-3xl leading-[1.1] sm:text-4xl">Welcome back</h1>
            <p className="mt-2.5 text-muted-foreground">Apply for leave, or see what is waiting for your decision.</p>
            <div className="mt-7 rounded-lg border bg-card p-5 shadow-soft sm:p-6">
              <ErrorBox error={error} className="mb-5" />
              {error?.code === 'EMAIL_NOT_VERIFIED' && (
                <div className="-mt-2 mb-5">
                  <Button type="button" variant="outline" onClick={resend}>Send it again</Button>
                  {resent && <p role="status" className="mt-3 text-sm font-medium text-status-green-fg">{resent}</p>}
                </div>
              )}
              <form onSubmit={submit} noValidate className="space-y-5">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={Boolean(error?.fields?.email)} />
                  <FieldError msg={error?.fields?.email} />
                </div>
                <div>
                  <div className="mb-1.5 flex items-baseline justify-between gap-3">
                    <Label htmlFor="password" className="mb-0">Password</Label>
                    <Link to="/forgot-password" className="inline-flex min-h-11 items-center text-sm font-medium text-brand underline-offset-4 hover:underline">Forgot your password?</Link>
                  </div>
                  <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={Boolean(error?.fields?.password)} />
                  <FieldError msg={error?.fields?.password} />
                </div>
                <Button variant="brand" className="w-full" size="lg" disabled={busy}>{busy ? 'Signing in' : 'Sign in'}</Button>
              </form>
              <p className="mt-5 text-sm text-muted-foreground">New here? <Link to="/signup" className="inline-flex min-h-11 items-center font-semibold text-foreground underline underline-offset-4">Create an account</Link></p>
            </div>
          </div>

          <section aria-labelledby="demo-title">
            <p className="kicker mb-2.5">Or try the demo</p>
            <h2 id="demo-title" className="font-display text-2xl leading-tight sm:text-3xl">Pick a person to sign in as</h2>
            <p className="mt-2.5 max-w-xl text-muted-foreground">One click, no password. Each person has their own requests, so you can follow a request from the employee to the manager to the HOD.</p>
            <div className="mt-7 space-y-7">
              {DEMO_GROUPS.map(([group, people]) => (
                <div key={group}>
                  <h3 className="kicker mb-3">{group}</h3>
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {people.map(([name, slug, note]) => (
                      <li key={slug}>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => signIn(`${slug}@akasa.demo`, PASSWORD)}
                          className="group flex h-full min-h-[4.5rem] w-full items-start gap-3.5 rounded-lg border bg-card p-4 text-left shadow-soft transition-colors hover:border-foreground/40 hover:bg-accent/50 disabled:opacity-50"
                        >
                          <Avatar name={name} className="size-11" />
                          <span className="min-w-0 flex-1">
                            <span className="block font-semibold">{name}</span>
                            <span className="mt-0.5 block text-sm text-muted-foreground">{note}</span>
                          </span>
                          <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
