import { AppError, forbidden } from './errors.js';

/**
 * The single place that decides which workflow transitions are legal.
 *
 * Statuses: PENDING_MANAGER, PENDING_HOD, INFO_REQUESTED, APPROVED, REJECTED, CANCELLED
 * Actions:  APPROVE, REJECT, REQUEST_INFO (approvers); REPLY, CANCEL, EDIT, ATTACH (owner)
 *
 * A "subject" is { employeeId, managerId, status, infoRequestedFrom, isLong, fromDate, hasApproval }.
 * An "actor" is { id, role }. All ids are compared as strings.
 */

const PENDING = ['PENDING_MANAGER', 'PENDING_HOD'];
const OPEN = [...PENDING, 'INFO_REQUESTED'];
const APPROVER_ACTIONS = ['APPROVE', 'REJECT', 'REQUEST_INFO'];
const OWNER_ACTIONS = ['REPLY', 'CANCEL', 'EDIT', 'ATTACH'];
export const ACTIONS = [...APPROVER_ACTIONS, ...OWNER_ACTIONS];

const stageOf = (status) => (status === 'PENDING_MANAGER' ? 'MANAGER' : status === 'PENDING_HOD' ? 'HOD' : null);

/** Status a brand-new request starts in, by the requester's role. */
export function initialStatus(role) {
  if (role === 'HOD') return 'APPROVED'; // HOD leave is auto-approved (flagged in the timeline)
  if (role === 'MANAGER') return 'PENDING_HOD'; // manager leave goes straight to the HOD
  return 'PENDING_MANAGER';
}

function statePermits(s, action, today) {
  switch (action) {
    case 'APPROVE':
    case 'REJECT':
    case 'REQUEST_INFO':
      return PENDING.includes(s.status);
    case 'REPLY':
      return s.status === 'INFO_REQUESTED';
    case 'CANCEL':
      return OPEN.includes(s.status) || (s.status === 'APPROVED' && s.fromDate > today);
    case 'ATTACH':
      return OPEN.includes(s.status) || s.status === 'APPROVED';
    case 'EDIT':
      return OPEN.includes(s.status) && !s.hasApproval;
    default:
      return false;
  }
}

function actorPermits(s, action, actor) {
  if (OWNER_ACTIONS.includes(action)) return actor.id === s.employeeId;
  if (actor.id === s.employeeId) return false; // never approve your own request
  const stage = stageOf(s.status);
  if (stage === 'MANAGER') return actor.role === 'MANAGER' && s.managerId === actor.id;
  if (stage === 'HOD') return actor.role === 'HOD';
  return false;
}

/** Actions the actor may currently take on the subject (drives UI buttons). */
export function allowedActions(subject, actor, today) {
  return ACTIONS.filter((a) => statePermits(subject, a, today) && actorPermits(subject, a, actor));
}

const STATE_MESSAGES = {
  APPROVED: 'This request has already been approved.',
  REJECTED: 'This request has already been rejected.',
  CANCELLED: 'This request has been cancelled.',
  INFO_REQUESTED: 'This request is waiting for more information from the employee.',
  PENDING_MANAGER: 'This request is still waiting for the manager.',
  PENDING_HOD: 'This request is already with the HOD.',
};

/**
 * Applies an action and returns the new { status, infoRequestedFrom }.
 * Throws 409 for an illegal transition and 403 when the actor may not perform it.
 */
export function applyAction(subject, action, actor, today) {
  if (!ACTIONS.includes(action)) throw new AppError(400, 'UNKNOWN_ACTION', 'That action is not supported.');
  if (!statePermits(subject, action, today)) {
    throw new AppError(
      409,
      'ILLEGAL_TRANSITION',
      STATE_MESSAGES[subject.status] ?? 'That action is not possible right now.',
      'Refresh the page to see the latest status.',
    );
  }
  if (!actorPermits(subject, action, actor)) {
    throw forbidden(
      actor.id === subject.employeeId && APPROVER_ACTIONS.includes(action)
        ? 'You cannot approve, reject or question your own request.'
        : 'You are not allowed to do that on this request.',
    );
  }
  const keep = { status: subject.status, infoRequestedFrom: subject.infoRequestedFrom };
  switch (action) {
    case 'APPROVE':
      if (subject.status === 'PENDING_MANAGER' && subject.isLong) return { status: 'PENDING_HOD', infoRequestedFrom: null };
      return { status: 'APPROVED', infoRequestedFrom: null };
    case 'REJECT':
      return { status: 'REJECTED', infoRequestedFrom: null };
    case 'REQUEST_INFO':
      return { status: 'INFO_REQUESTED', infoRequestedFrom: stageOf(subject.status) };
    case 'REPLY':
      return { status: subject.infoRequestedFrom === 'HOD' ? 'PENDING_HOD' : 'PENDING_MANAGER', infoRequestedFrom: null };
    case 'CANCEL':
      return { status: 'CANCELLED', infoRequestedFrom: null };
    default:
      return keep; // EDIT and ATTACH do not change status
  }
}
