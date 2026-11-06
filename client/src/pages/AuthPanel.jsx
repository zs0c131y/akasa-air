import { CalendarDays, MailCheck, ShieldCheck } from 'lucide-react';
import { excludedSummary, leaveBreakdown } from '@lms/shared';
import { Avatar, StatusChip } from '../components.jsx';

const SAMPLE = { from: '2026-12-24', to: '2026-12-28', holidays: [{ date: '2026-12-25', name: 'Christmas Day' }] };

/** A small, made-up request card so the panel shows the real product, not a picture of it. */
function MiniRequest() {
  const b = leaveBreakdown(SAMPLE.from, SAMPLE.to, SAMPLE.holidays);
  const note = excludedSummary(b);
  return (
    <div className="rounded-lg border bg-card p-4 text-card-foreground shadow-lift">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name="Kavya Reddy" className="size-10 shrink-0" />
          <div className="min-w-0">
            <p className="truncate font-semibold">Kavya Reddy</p>
            <p className="font-mono text-xs text-muted-foreground">24 Dec to 28 Dec</p>
          </div>
        </div>
        <StatusChip status="PENDING_MANAGER" className="shrink-0" />
      </div>
      <p className="mt-3 text-sm">
        <span className="font-semibold">{b.days} days</span>
        <span className="text-muted-foreground"> · {note}</span>
      </p>
      <p className="mt-1 text-sm text-muted-foreground">A cousin's wedding in Jaipur.</p>
    </div>
  );
}

const SIGNUP_STEPS = [
  ['Create your account', 'Your name, work email and a password.'],
  ['Confirm your email', 'If we sent you a link, open it once.'],
  ['Get a manager', 'The Head of Department picks your manager, then you can ask for leave.'],
];

const LINK_COPY = {
  forgot: {
    icon: MailCheck,
    label: 'What the link does',
    title: 'One link, one new password',
    body: 'We email you a link to choose a new password. It works for 60 minutes, and only once.',
    note: 'If you did not ask for this, ignore the email. Your password stays as it is.',
  },
  reset: {
    icon: ShieldCheck,
    label: 'Choosing a new password',
    title: 'Pick one you have not used before',
    body: 'Use at least the length the form asks for, and keep your name and email out of it. Once saved, the link stops working.',
    note: 'If you did not ask for this, close the page. Your password stays as it is.',
  },
  verify: {
    icon: MailCheck,
    label: 'Confirming your email',
    title: 'Why we ask',
    body: 'The confirmation link works for 24 hours. It shows the address is yours, so request updates reach the right person.',
    note: 'If the link has run out, sign in and we will offer to send a new one.',
  },
};

/**
 * Dark side panel for the auth pages at lg and up. Hidden on phones, so the form stays first and nothing overflows.
 * `variant` is 'signup' (the full "what happens next" panel) or 'forgot' | 'reset' | 'verify' (a smaller one).
 */
export function AuthPanel({ variant }) {
  if (variant === 'signup') {
    return (
      <div className="dark hidden lg:block">
        <div className="gridlines relative flex h-full flex-col justify-between gap-10 overflow-hidden rounded-xl border bg-background p-10 text-foreground">
          <div>
            <p className="kicker">What happens next</p>
            <ol className="mt-6 space-y-6">
              {SIGNUP_STEPS.map(([title, text], i) => (
                <li key={title} className="flex gap-4">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-flame font-mono text-sm font-semibold text-flame-foreground">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-display text-xl leading-tight">{title}</p>
                    <p className="mt-1 text-muted-foreground">{text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <p className="kicker mb-3 flex items-center gap-2">
              <CalendarDays className="size-4" aria-hidden="true" /> A request, once you are set up
            </p>
            <div aria-hidden="true">
              <MiniRequest />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">Sample person and dates. Sundays and public holidays are never counted.</p>
          </div>
        </div>
      </div>
    );
  }
  const c = LINK_COPY[variant];
  if (!c) return null;
  const Icon = c.icon;
  return (
    <div className="dark hidden lg:block">
      <div className="gridlines relative flex h-full flex-col justify-center gap-6 overflow-hidden rounded-xl border bg-background p-10 text-foreground">
        <p className="kicker">{c.label}</p>
        <Icon className="size-9 text-brand" aria-hidden="true" />
        <h2 className="font-display text-2xl leading-tight">{c.title}</h2>
        <p className="text-muted-foreground">{c.body}</p>
        <p className="border-t pt-5 text-sm text-muted-foreground">{c.note}</p>
      </div>
    </div>
  );
}
