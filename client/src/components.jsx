import { STATUS_LABELS } from '@lms/shared';

const ICONS = {
  PENDING_MANAGER: '◔',
  PENDING_HOD: '◑',
  INFO_REQUESTED: '?',
  APPROVED: '✓',
  REJECTED: '✕',
  CANCELLED: '–',
};

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
