import { Component } from 'react';
import { Link } from 'react-router-dom';
import { Ban, CircleAlert, CircleCheck, CircleHelp, CircleX, Clock, Hourglass, SearchX, ShieldAlert, WifiOff } from 'lucide-react';
import { STATUSES, STATUS_LABELS } from '@lms/shared';
import { Badge } from './ui/badge.jsx';
import { Button } from './ui/button.jsx';
import { Card } from './ui/card.jsx';
import { cn } from './lib/utils.js';

export function BrandMark({ className = 'size-7' }) {
  return (
    <svg className={cn('text-brand', className)} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect x="2" y="2" width="28" height="28" rx="8" fill="currentColor" />
      <rect x="8" y="9" width="16" height="15" rx="2.5" fill="none" stroke="hsl(var(--brand-foreground))" strokeWidth="1.8" />
      <path d="M8 14h16M12.5 6.5v4M19.5 6.5v4" stroke="hsl(var(--brand-foreground))" strokeWidth="1.8" strokeLinecap="round" />
      <path d="m12.5 19 2.5 2.5 4.5-5" fill="none" stroke="hsl(var(--brand-foreground))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export const Wordmark = ({ className }) => (
  <span className={cn('inline-flex items-center gap-2.5 text-[1.05rem] font-semibold tracking-tight', className)}>
    <BrandMark /> Leave Desk
  </span>
);

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

/** Status chip: colour + icon + text, never colour alone. */
export function StatusChip({ status, className }) {
  const { icon: Icon, variant } = STATUS_STYLE[status];
  return (
    <Badge variant={variant} data-status={status} className={cn('gap-1.5 rounded-full px-2.5 py-1 text-[0.8rem]', className)}>
      <Icon className="size-3.5" aria-hidden="true" />
      {STATUS_LABELS[status]}
    </Badge>
  );
}

export function Badges({ leave }) {
  return (
    <>
      {leave.isLong && <Badge variant="blue">Long leave</Badge>}
      {leave.isEmergency && <Badge variant="red">Emergency</Badge>}
      {leave.documentsPending && <Badge variant="amber">Documents due {leave.documentsDueBy}</Badge>}
    </>
  );
}

export function Avatar({ name, className }) {
  const initials = String(name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  return (
    <span aria-hidden="true" className={cn('inline-grid size-10 shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold text-foreground', className)}>
      {initials}
    </span>
  );
}

/** Shows a friendly API error with its hint. */
export function ErrorBox({ error, className }) {
  if (!error) return null;
  return (
    <div role="alert" className={cn('flex gap-3 rounded-lg border border-destructive/40 bg-status-red-bg p-4 text-status-red-fg', className)}>
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
    <div role="status" className={cn('flex gap-3 rounded-lg border border-status-amber-fg/40 bg-status-amber-bg p-4 text-status-amber-fg', className)}>
      <Clock className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div className="text-sm font-medium">{children}</div>
    </div>
  );
}

/** Full-panel friendly screen for 403 / 404 / offline / unexpected errors. */
export function ErrorScreen({ error }) {
  const map = {
    403: [ShieldAlert, 'You do not have access to this page', 'Ask your manager if you think this is a mistake, or go back to your requests.'],
    404: [SearchX, 'We could not find that', 'It may have been removed, or it may belong to someone else.'],
    401: [ShieldAlert, 'Please sign in again', 'Your session has ended.'],
  };
  const [Icon, title, hint] = error?.code === 'NETWORK'
    ? [WifiOff, 'You seem to be offline', 'Check your internet connection and reload the page.']
    : map[error?.status] ?? [CircleAlert, 'Something went wrong', error?.hint || 'Please try again in a moment.'];
  return (
    <Card role="alert" className="mx-auto mt-10 max-w-lg p-8 text-center">
      <Icon className="mx-auto size-10 text-muted-foreground" aria-hidden="true" />
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">{title}</h1>
      {error?.message && <p className="mt-2">{error.message}</p>}
      <p className="mt-1 text-muted-foreground">{hint}</p>
      <Button asChild variant="outline" className="mt-6"><Link to="/">Back to my requests</Link></Button>
    </Card>
  );
}

/** Catches unexpected render errors so users never see a blank page or a stack trace. */
export class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main role="alert" className="mx-auto mt-24 max-w-md px-4 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
        <p className="mt-2 text-muted-foreground">Please reload the page. Your submitted requests are safe.</p>
        <Button className="mt-6" onClick={() => window.location.assign('/')}>Reload</Button>
      </main>
    );
  }
}

/** Colour key shown above request lists. */
export function StatusLegend() {
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Status colour key">
      {STATUSES.map((s) => <li key={s}><StatusChip status={s} /></li>)}
    </ul>
  );
}

export const FieldError = ({ msg, id }) => (msg ? <p id={id} className="mt-1.5 text-sm font-medium text-destructive">{msg}</p> : null);

export function PageHeader({ title, description, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-4xl leading-none tracking-tight sm:text-5xl">{title}</h1>
        {description && <p className="mt-3 max-w-2xl text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  );
}

export function Pager({ page, pages, setPage }) {
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pages" className="mt-6 flex items-center justify-center gap-4">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
      <span className="text-sm text-muted-foreground">Page {page} of {pages}</span>
      <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
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
