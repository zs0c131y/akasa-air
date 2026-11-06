import { Component } from 'react';
import { Link } from 'react-router-dom';
import { Ban, CircleAlert, CircleCheck, CircleHelp, CircleX, Clock, Hourglass } from 'lucide-react';
import { useAuth } from './auth.jsx';
import { STATUSES, STATUS_LABELS, excludedSummary } from '@lms/shared';
import { ClosedGate, LostTag, Person, Unplugged } from './illustrations.jsx';
import { Badge } from './ui/badge.jsx';
import { Button } from './ui/button.jsx';
import { cn } from './lib/utils.js';

export const PRODUCT_NAME = 'Layover';

/** Akasa Air logo (public/brand/akasa-air-logo.png) next to the name, with the product name beside it. */
export function Brand({ className, compact = false }) {
  return (
    <span className={cn('inline-flex items-center gap-3', className)}>
      <img src="/brand/akasa-air-logo.png" alt="" width="38" height="26" className="h-[1.6rem] w-auto shrink-0" />
      <span className="flex items-baseline gap-2.5 leading-none">
        <span className="text-[1.05rem] font-bold tracking-tight">Akasa Air</span>
        {!compact && <span aria-hidden="true" className="h-4 w-px self-center bg-foreground/30" />}
        {!compact && <span className="font-display text-[1.45rem] leading-none tracking-tight">{PRODUCT_NAME}</span>}
      </span>
    </span>
  );
}
export const Wordmark = Brand;

const STATUS_STYLE = {
  PENDING_MANAGER: { icon: Clock, variant: 'amber' },
  PENDING_HOD: { icon: Hourglass, variant: 'blue' },
  INFO_REQUESTED: { icon: CircleHelp, variant: 'purple' },
  APPROVED: { icon: CircleCheck, variant: 'green' },
  REJECTED: { icon: CircleX, variant: 'red' },
  CANCELLED: { icon: Ban, variant: 'neutral' },
};
/** Left-edge accent for request rows, matching the status colour. */
export const STATUS_EDGE = {
  PENDING_MANAGER: 'border-l-status-amber-fg',
  PENDING_HOD: 'border-l-status-blue-fg',
  INFO_REQUESTED: 'border-l-status-purple-fg',
  APPROVED: 'border-l-status-green-fg',
  REJECTED: 'border-l-status-red-fg',
  CANCELLED: 'border-l-status-grey-fg',
};
/** Solid fill in the status colour: for small bars and dots that sit beside a word. */
export const STATUS_BAR = {
  PENDING_MANAGER: 'bg-status-amber-fg',
  PENDING_HOD: 'bg-status-blue-fg',
  INFO_REQUESTED: 'bg-status-purple-fg',
  APPROVED: 'bg-status-green-fg',
  REJECTED: 'bg-status-red-fg',
  CANCELLED: 'bg-status-grey-fg',
};

/**
 * The words on a status chip, from the point of view of whoever is looking. The person who has to decide sees
 * "Waiting for you"; the employee sees who has it ("With your manager"); everyone else sees the plain status.
 */
export function statusLabelFor(status, leave, user) {
  if (!leave || !user) return STATUS_LABELS[status];
  const mine = leave.employeeId === user.id;
  const actions = leave.allowedActions ?? [];
  if (actions.includes('APPROVE')) return 'Waiting for you';
  if (status === 'INFO_REQUESTED') return mine ? 'Waiting for your reply' : 'Waiting for their reply';
  if (status === 'PENDING_MANAGER') return mine ? 'With your manager' : 'With the manager';
  if (status === 'PENDING_HOD') return 'With the HOD';
  return STATUS_LABELS[status];
}

/** Status chip: a pill with colour, icon and word, never colour alone. Pass `leave` to word it for the person looking. */
export function StatusChip({ status, leave, className }) {
  const { icon: Icon, variant } = STATUS_STYLE[status];
  const { user } = useAuth() ?? {};
  return (
    <Badge
      variant={variant}
      data-status={status}
      className={cn('gap-1.5 rounded-full px-2.5 py-1 text-[0.78rem] font-semibold', className)}
    >
      <Icon className="size-3.5" aria-hidden="true" strokeWidth={2.4} />
      {statusLabelFor(status, leave, user)}
    </Badge>
  );
}

export function Badges({ leave }) {
  return (
    <>
      {leave.isLong && <Badge variant="blue">Long leave</Badge>}
      {leave.splitFlag && <Badge variant="amber">In a row with other leave</Badge>}
      {leave.isEmergency && <Badge variant="red">Emergency</Badge>}
      {leave.documentsPending && <Badge variant="amber">Documents due {leave.documentsDueBy}</Badge>}
    </>
  );
}

/** A person's illustrated face (see Person in illustrations.jsx). Pass a size class such as "size-12". */
export function Avatar({ name, className }) {
  return <Person name={name} className={className} />;
}

/** Shows a friendly API error with its hint. */
export function ErrorBox({ error, className }) {
  if (!error) return null;
  return (
    <div
      role="alert"
      className={cn('flex gap-3 rounded-lg border border-status-red-fg/30 bg-status-red-bg p-4 text-status-red-fg', className)}
    >
      <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div>
        <p className="font-semibold">{error.message}</p>
        {error.hint && <p className="mt-0.5 text-sm">{error.hint}</p>}
      </div>
    </div>
  );
}

export function Notice({ children, className }) {
  return (
    <div
      role="status"
      className={cn('flex gap-3 rounded-lg border border-status-amber-fg/30 bg-status-amber-bg p-4 text-status-amber-fg', className)}
    >
      <Clock className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div className="text-sm font-medium">{children}</div>
    </div>
  );
}

/** Full-panel friendly screen for 403 / 404 / offline / unexpected errors. */
export function ErrorScreen({ error }) {
  const map = {
    403: [
      ClosedGate,
      'You do not have access to this page',
      'If you think this is a mistake, ask your manager. Otherwise go back to your requests.',
    ],
    404: [
      LostTag,
      'We could not find that',
      'It may have been removed, or it may belong to someone else. Check the link, or go back to your requests.',
    ],
    401: [ClosedGate, 'Please sign in again', 'Your session has ended. Sign in again to carry on.'],
  };
  const [Art, title, hint] =
    error?.code === 'NETWORK'
      ? [Unplugged, 'You seem to be offline', 'Check your internet connection and reload the page.']
      : (map[error?.status] ?? [LostTag, 'Something went wrong', error?.hint || 'Please try again in a moment.']);
  return (
    <div role="alert" className="mx-auto mt-6 max-w-lg rounded-lg border bg-card px-6 py-12 text-center shadow-soft">
      <Art className="mx-auto" />
      <h1 className="font-display mt-6 text-3xl leading-tight sm:text-4xl">{title}</h1>
      {error?.message && <p className="mt-3 font-medium">{error.message}</p>}
      <p className="mt-1 text-muted-foreground">{hint}</p>
      <Button asChild variant="outline" className="mt-7">
        <Link to="/">Back to my requests</Link>
      </Button>
    </div>
  );
}

/** Catches unexpected render errors so users never see a blank page or a stack trace. */
export class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main role="alert" className="mx-auto mt-24 max-w-md px-4 text-center">
        <h1 className="font-display text-2xl">Something went wrong</h1>
        <p className="mt-2 text-muted-foreground">Reload the page to try again. Requests you have already sent are safe.</p>
        <Button className="mt-6" onClick={() => window.location.assign('/')}>
          Reload
        </Button>
      </main>
    );
  }
}

/** Colour key shown above request lists. */
export function StatusLegend() {
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Status key">
      {STATUSES.map((s) => (
        <li key={s}>
          <StatusChip status={s} />
        </li>
      ))}
    </ul>
  );
}

export const FieldError = ({ msg, id }) =>
  msg ? (
    <p id={id} role="alert" className="mt-1.5 text-sm font-medium text-destructive">
      {msg}
    </p>
  ) : null;

export function PageHeader({ title, description, kicker, children }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
      <div className="min-w-0">
        {kicker && <p className="kicker mb-2.5">{kicker}</p>}
        <h1 className="font-display text-3xl leading-[1.1] sm:text-4xl">{title}</h1>
        {description && <p className="mt-2.5 max-w-2xl text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  );
}

/** A white card with a heading: the building block of the request page, forms and side panels. */
export function Panel({ title, kicker, children, className, as: As = 'section' }) {
  return (
    <As className={cn('rounded-lg border bg-card p-5 shadow-soft sm:p-6', className)}>
      {kicker && <p className="kicker mb-1.5">{kicker}</p>}
      {title && <h2 className="font-display mb-4 text-xl leading-tight">{title}</h2>}
      {children}
    </As>
  );
}

/** "5 days" plus, when something was left out of the count, why. */
export function DaysLabel({ leave, className }) {
  const note = leave.excluded ? excludedSummary(leave.excluded) : '';
  return (
    <span className={className}>
      <span className="num">
        {leave.days} day{leave.days === 1 ? '' : 's'}
      </span>
      {note && <span className="text-muted-foreground"> · {note}</span>}
    </span>
  );
}

export function Pager({ page, pages, setPage }) {
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pages" className="mt-6 flex items-center justify-between gap-4">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
        Previous
      </Button>
      <span className="font-mono text-xs text-muted-foreground">
        Page {page} of {pages}
      </span>
      <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>
        Next
      </Button>
    </nav>
  );
}

export const fmtDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
export const fmtDateTime = (d) => new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export const ACTION_LABELS = {
  SUBMITTED: 'Submitted',
  APPROVE: 'Approved',
  REJECT: 'Rejected',
  REQUEST_INFO: 'Asked for more information',
  REPLY: 'Replied',
  CANCEL: 'Cancelled',
  EDIT: 'Edited',
  ATTACH: 'Sent documents',
  AUTO_APPROVED: 'Auto-approved',
};
