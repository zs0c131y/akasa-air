import { Component } from 'react';
import { Link } from 'react-router-dom';
import { STATUSES, STATUS_LABELS } from '@lms/shared';

const ICONS = {
  PENDING_MANAGER: '◔',
  PENDING_HOD: '◑',
  INFO_REQUESTED: '?',
  APPROVED: '✓',
  REJECTED: '✕',
  CANCELLED: '–',
};

export function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="8" fill="currentColor" opacity=".12" />
      <rect x="6" y="8" width="20" height="18" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M6 14h20M11 5v6M21 5v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="m12 20 3 3 5-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Status chip: colour + icon + text, never colour alone. */
export function StatusChip({ status }) {
  return (
    <span className={`chip chip-${status}`}>
      <span aria-hidden="true">{ICONS[status]}</span> {STATUS_LABELS[status]}
    </span>
  );
}

export function Badges({ leave }) {
  return (
    <>
      {leave.isLong && <span className="badge badge-long">Long leave</span>}
      {leave.isEmergency && <span className="badge badge-emergency">Emergency</span>}
      {leave.documentsPending && <span className="badge badge-docs">Documents due {leave.documentsDueBy}</span>}
    </>
  );
}

/** Shows a friendly API error with its hint. */
export function ErrorBox({ error }) {
  if (!error) return null;
  return (
    <div className="error" role="alert">
      <strong>{error.message}</strong>
      {error.hint && <div>{error.hint}</div>}
    </div>
  );
}

/** Full-panel friendly screen for 403 / 404 / offline / unexpected errors. */
export function ErrorScreen({ error }) {
  const map = {
    403: ['You do not have access to this page', 'Ask your manager if you think this is a mistake, or go back to your requests.'],
    404: ['We could not find that', 'It may have been removed, or it may belong to someone else.'],
    401: ['Please sign in again', 'Your session has ended.'],
  };
  const [title, hint] = error?.code === 'NETWORK'
    ? ['You seem to be offline', 'Check your internet connection and reload the page.']
    : map[error?.status] ?? ['Something went wrong', error?.hint || 'Please try again in a moment.'];
  return (
    <div className="card center" role="alert">
      <h1>{title}</h1>
      <p>{error?.message}</p>
      <p className="muted">{hint}</p>
      <Link className="button secondary" to="/">Back to my requests</Link>
    </div>
  );
}

/** Catches unexpected render errors so users never see a blank page or a stack trace. */
export class ErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="card center" role="alert">
        <h1>Something went wrong</h1>
        <p className="muted">Please reload the page. Your submitted requests are safe.</p>
        <button className="primary" onClick={() => window.location.assign('/')}>Reload</button>
      </main>
    );
  }
}

/** Colour key shown above request lists. */
export function StatusLegend() {
  return (
    <ul className="legend" aria-label="Status colour key">
      {STATUSES.map((s) => <li key={s}><StatusChip status={s} /></li>)}
    </ul>
  );
}

export const FieldError = ({ msg }) => (msg ? <div className="field-error">{msg}</div> : null);

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
