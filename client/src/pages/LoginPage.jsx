import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { Avatar, ErrorBox, FieldError, Wordmark } from '../components.jsx';
import { ThemeToggle } from '../theme.jsx';
import { Button } from '../ui/button.jsx';
import { Input, Label } from '../ui/input.jsx';

const PASSWORD = 'Password@123';
const DEMO_GROUPS = [
  ['Head of Department', [['Priya Nair', 'priya.nair', 'Final approver, sees the audit log']]],
  ['Managers', [['Rahul Mehta', 'rahul.mehta', 'Approves for the team'], ['Ananya Iyer', 'ananya.iyer', 'Approves for the team']]],
  ['Employees', [
    ['Arjun Sharma', 'arjun.sharma', 'Has requests waiting'], ['Kavya Reddy', 'kavya.reddy', 'Asked for more information'],
    ['Rohan Das', 'rohan.das', 'Long leave at the HOD stage'], ['Sneha Kulkarni', 'sneha.kulkarni', 'Approved and pending leave'],
    ['Imran Khan', 'imran.khan', 'Emergency leave owing documents'], ['Meera Joshi', 'meera.joshi', 'Waiting on a reply'],
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
    <div className="min-h-screen">
      <header className="container flex h-16 items-center justify-between">
        <Link to="/" className="rounded-md" aria-label="Leave Desk home"><Wordmark /></Link>
        <ThemeToggle />
      </header>
      <main className="container grid gap-10 pb-20 pt-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-20 lg:pt-14">
        <div>
          <Link to="/" className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" aria-hidden="true" /> Back to home
          </Link>
          <h1 className="font-display text-5xl leading-none tracking-tight">Welcome back</h1>
          <p className="mt-3 text-muted-foreground">Sign in to apply for leave or review requests.</p>
          <ErrorBox error={error} className="mt-6" />
          <form onSubmit={(e) => { e.preventDefault(); signIn(email, password); }} noValidate className="mt-6 space-y-5">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={Boolean(error?.fields?.email)} />
              <FieldError msg={error?.fields?.email} />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={Boolean(error?.fields?.password)} />
              <FieldError msg={error?.fields?.password} />
            </div>
            <Button className="w-full" size="lg" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
          </form>
        </div>

        <section aria-labelledby="demo-title" className="rounded-xl border bg-card p-5 shadow-soft sm:p-7">
          <h2 id="demo-title" className="text-lg font-semibold tracking-tight">Or sign in with a demo account</h2>
          <p className="mt-1 text-sm text-muted-foreground">One click, no password. Each person comes with their own requests, so you can see every screen.</p>
          <div className="mt-6 space-y-6">
            {DEMO_GROUPS.map(([group, people]) => (
              <div key={group}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{group}</h3>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {people.map(([name, slug, note]) => (
                    <li key={slug}>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => signIn(`${slug}@akasa.demo`, PASSWORD)}
                        className="group flex min-h-14 w-full items-center gap-3 rounded-lg border bg-background p-2.5 text-left transition-colors hover:border-foreground/40 hover:bg-accent disabled:opacity-50"
                      >
                        <Avatar name={name} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{name}</span>
                          <span className="block truncate text-xs text-muted-foreground">{note}</span>
                        </span>
                        <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
