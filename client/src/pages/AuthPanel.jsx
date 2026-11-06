import { CalendarDays, MailCheck, ShieldCheck } from 'lucide-react';
import { excludedSummary, leaveBreakdown } from '@lms/shared';
import { Avatar, StatusChip } from '../components.jsx';

const SAMPLE = { from: '2026-12-24', to: '2026-12-28', holidays: [{ date: '2026-12-25', name: 'Christmas Day' }] };

/** A small, made-up request card so the panel shows the real product, not a picture of it. */
function MiniRequest() {
  const b = leaveBreakdown(SAMPLE.from, SAMPLE.to, SAMPLE.holidays);
  const note = excludedSummary(b);
  return (
    <div className="rounded-lg border bg-card p-3 text-card-foreground">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name="Kavya Reddy" className="size-8 shrink-0" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Kavya Reddy</p>
            <p className="font-mono text-[0.7rem] text-muted-foreground">24 to 28 Dec</p>
          </div>
        </div>
        <StatusChip status="PENDING_MANAGER" className="shrink-0 px-2 py-0.5 text-[0.7rem]" />
      </div>
      <p className="mt-2 text-xs">
        <span className="font-semibold">{b.days} days</span>
        <span className="text-muted-foreground"> · {note}</span>
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">A cousin's wedding in Jaipur.</p>
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
      <div className="dark hidden self-start lg:sticky lg:top-24 lg:block">
        <div className="gridlines relative flex flex-col gap-6 overflow-hidden rounded-xl border bg-background p-6 text-foreground">
          <div>
            <p className="kicker">What happens next</p>
            <ol className="mt-4 space-y-4">
              {SIGNUP_STEPS.map(([title, text], i) => (
                <li key={title} className="flex gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-flame font-mono text-xs font-semibold text-flame-foreground">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-base font-bold leading-tight">{title}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <p className="kicker mb-2 flex items-center gap-2">
              <CalendarDays className="size-4" aria-hidden="true" /> A request, once you are set up
            </p>
            <div aria-hidden="true">
              <MiniRequest />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Sample person and dates. Sundays and public holidays are never counted.</p>
          </div>
        </div>
      </div>
    );
  }
  const c = LINK_COPY[variant];
  if (!c) return null;
  const Icon = c.icon;
  return (
    <div className="dark hidden self-start lg:sticky lg:top-24 lg:block">
      <div className="gridlines relative flex flex-col gap-4 overflow-hidden rounded-xl border bg-background p-6 text-foreground">
        <p className="kicker">{c.label}</p>
        <Icon className="size-7 text-brand" aria-hidden="true" />
        <h2 className="text-lg font-bold leading-tight">{c.title}</h2>
        <p className="text-sm text-muted-foreground">{c.body}</p>
        <p className="border-t pt-4 text-xs text-muted-foreground">{c.note}</p>
      </div>
    </div>
  );
}
