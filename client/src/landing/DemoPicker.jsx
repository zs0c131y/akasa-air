import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, LoaderCircle } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { Avatar, ErrorBox } from '../components.jsx';
import { cn } from '../lib/utils.js';

/* The demo accounts share one password. It is only ever sent to the sign-in call, never shown. */
const DEMO_PASSWORD = 'Password@123';

export const DEMO_PEOPLE = [
  ['Priya Nair', 'priya.nair', 'Head of Department', 'Final approver. Sees the audit log and keeps the holidays.'],
  ['Rahul Mehta', 'rahul.mehta', 'Manager', 'Has requests waiting in the queue.'],
  ['Ananya Iyer', 'ananya.iyer', 'Manager', 'Has approved some, passed some on.'],
  ['Arjun Sharma', 'arjun.sharma', 'Employee', 'Two requests waiting on the manager.'],
  ['Kavya Reddy', 'kavya.reddy', 'Employee', 'Was asked for more information.'],
  ['Rohan Das', 'rohan.das', 'Employee', 'Long leave waiting on the HOD.'],
  ['Sneha Kulkarni', 'sneha.kulkarni', 'Employee', 'One approved, one at the HOD.'],
  ['Imran Khan', 'imran.khan', 'Employee', 'Emergency leave owing documents.'],
  ['Meera Joshi', 'meera.joshi', 'Employee', 'HOD asked for the return ticket.'],
];

/** Nine demo people. One click signs in as that person; the app then opens on their own screen. */
export function DemoPicker() {
  const { login } = useAuth();
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  const signIn = async (slug) => {
    setBusy(slug);
    setError(null);
    try {
      await login(`${slug}@akasa.demo`, DEMO_PASSWORD);
    } catch (err) {
      setError(err);
      setBusy(null);
    }
  };

  return (
    <div>
      <ErrorBox error={error} className="mb-6" />
      <ul data-stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy={Boolean(busy)}>
        {DEMO_PEOPLE.map(([name, slug, role, note]) => {
          const mine = busy === slug;
          return (
            <li key={slug}>
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => signIn(slug)}
                className={cn(
                  'group flex h-full min-h-[5.5rem] w-full items-center gap-4 rounded-lg border border-border bg-card p-4 text-left shadow-soft transition-colors',
                  'hover:border-foreground/40 disabled:cursor-not-allowed',
                  busy && !mine && 'opacity-50',
                  mine && 'border-brand',
                )}
              >
                <Avatar name={name} className="size-12" />
                <span className="min-w-0 flex-1">
                  <span className="kicker block">{role}</span>
                  <span className="mt-1 block font-semibold leading-tight">{name}</span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">{mine ? 'Signing in…' : note}</span>
                </span>
                {mine ? (
                  <LoaderCircle className="size-5 shrink-0 animate-spin text-brand" aria-hidden="true" />
                ) : (
                  <ArrowRight
                    className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-foreground"
                    aria-hidden="true"
                  />
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="sr-only" role="status">
        {busy ? `Signing in as ${DEMO_PEOPLE.find((p) => p[1] === busy)[0]}…` : ''}
      </p>
      <p className="mt-6 text-sm text-muted-foreground">
        Have a real account?{' '}
        <Link
          to="/login"
          className="inline-flex min-h-11 items-center font-medium text-brand underline underline-offset-4 hover:opacity-80"
        >
          Sign in with your own account
        </Link>
      </p>
    </div>
  );
}
