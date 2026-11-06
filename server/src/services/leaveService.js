import mongoose from 'mongoose';
import {
  MAX_FILES,
  MAX_FILE_BYTES,
  ALLOWED_MIME,
  STATUSES,
  leaveBreakdown,
  consecutiveChain,
  absenceDays,
  makeLeaveInputSchema,
  documentsAccepted,
  isLongLeave,
  documentRequirementError,
  emergencyBlockMessage,
  todayISO,
  parseISODate,
  zodFields,
} from '@lms/shared';
import { LeaveRequest } from '../models/LeaveRequest.js';
import { holidaysFor, listHolidays } from './holidayService.js';
import { assertEnoughLeave } from './allowanceService.js';
import { AppError, notFound, conflict, validationError } from '../errors.js';
import { storage, sniffMime, safeFilename } from '../storage/index.js';
import { allowedActions, applyAction, initialStatus } from '../workflow.js';

const ACTIVE = ['PENDING_MANAGER', 'PENDING_HOD', 'INFO_REQUESTED', 'APPROVED'];

/** True when an emergency leave over the threshold was filed without any document yet. */
const owesDocuments = (d) => d.isEmergency && d.isLong && d.documents.length === 0 && ACTIVE.includes(d.status);
/** The next working day after `iso` (skips Sunday): when the employee is back and documents fall due. */
const nextDay = (iso) => {
  let t = parseISODate(iso) + 86400000;
  if (new Date(t).getUTCDay() === 0) t += 86400000;
  return new Date(t).toISOString().slice(0, 10);
};

const sid = (v) => (v == null ? null : String(v));
const actorOf = (user) => ({ id: user.id, role: user.role });

function toSubject(doc) {
  return {
    employeeId: sid(doc.employeeId),
    managerId: sid(doc.managerId),
    status: doc.status,
    infoRequestedFrom: doc.infoRequestedFrom ?? null,
    isLong: doc.isLong,
    fromDate: doc.fromDate,
    hasApproval: doc.timeline.some((t) => t.action === 'APPROVE'),
  };
}

/** Which requests a user is allowed to see. */
function visibilityFilter(user) {
  if (user.role === 'HOD') return {};
  if (user.role === 'MANAGER') return { $or: [{ managerId: user.id }, { employeeId: user.id }] };
  return { employeeId: user.id };
}

function canView(doc, user) {
  if (user.role === 'HOD') return true;
  if (sid(doc.employeeId) === user.id) return true;
  return user.role === 'MANAGER' && sid(doc.managerId) === user.id;
}

/** Public shape of a request, including what the current user can do with it. */
export function serialize(doc, user) {
  return {
    id: String(doc._id),
    employeeId: sid(doc.employeeId),
    employeeName: doc.employeeName,
    fromDate: doc.fromDate,
    toDate: doc.toDate,
    days: doc.days,
    chainDays: doc.chainDays ?? doc.days,
    absenceDays: doc.absenceDays ?? null,
    splitFlag: Boolean(doc.splitFlag),
    joinedWith: (doc.joinedWith ?? []).map((j) => ({
      id: j.requestId ? String(j.requestId) : null,
      fromDate: j.fromDate,
      toDate: j.toDate,
      days: j.days,
    })),
    excluded: { sundays: doc.excludedSundays ?? 0, holidays: (doc.excludedHolidays ?? []).map((h) => ({ date: h.date, name: h.name })) },
    isLong: doc.isLong,
    reason: doc.reason,
    isEmergency: doc.isEmergency,
    documentsPending: owesDocuments(doc),
    documentsDueBy: owesDocuments(doc) ? nextDay(doc.toDate) : null,
    status: doc.status,
    infoRequestedFrom: doc.infoRequestedFrom ?? null,
    version: doc.__v,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    documents: doc.documents.map((d) => ({
      id: String(d._id),
      name: d.originalName,
      mimeType: d.mimeType,
      size: d.size,
      uploadedAt: d.uploadedAt,
    })),
    timeline: doc.timeline.map((t) => ({
      at: t.at,
      actorName: t.actorName,
      actorRole: t.actorRole,
      action: t.action,
      fromStatus: t.fromStatus,
      toStatus: t.toStatus,
      comment: t.comment,
    })),
    allowedActions: allowedActions(toSubject(doc), actorOf(user), todayISO()),
  };
}

function entry(user, action, fromStatus, toStatus, comment) {
  return { at: new Date(), actorId: user.id, actorName: user.name, actorRole: user.role, action, fromStatus, toStatus, comment };
}

/** Checks type (by magic bytes), size and count of uploaded files. Returns buffers ready to store. */
function prepareFiles(files = [], alreadyAttached = 0) {
  if (alreadyAttached + files.length > MAX_FILES) {
    throw validationError(
      { documents: `You can attach at most ${MAX_FILES} documents per request.` },
      `Too many documents. The limit is ${MAX_FILES} per request.`,
    );
  }
  return files.map((f) => {
    const mime = sniffMime(f.buffer);
    if (!mime || !ALLOWED_MIME.includes(mime)) {
      throw validationError(
        { documents: `"${safeFilename(f.originalname)}" is not a PDF, JPG or PNG file. Please convert it and try again.` },
        'One of the documents is not an allowed file type.',
      );
    }
    if (f.size > MAX_FILE_BYTES) {
      throw validationError({ documents: `"${safeFilename(f.originalname)}" is larger than 5 MB. Please attach a smaller file.` });
    }
    return { buffer: f.buffer, mime, name: safeFilename(f.originalname), size: f.size };
  });
}

async function storeFiles(prepared, user) {
  const docs = [];
  for (const p of prepared) {
    const key = await storage.save(p.buffer);
    docs.push({ key, originalName: p.name, mimeType: p.mime, size: p.size, uploadedBy: user.id });
  }
  return docs;
}

async function parseLeaveInput(body, user) {
  // The holiday calendar is the single source of truth for what is not counted, on the server and in the form.
  const from = typeof body?.fromDate === 'string' ? body.fromDate : '';
  const to = typeof body?.toDate === 'string' ? body.toDate : '';
  // National holidays plus the ones for the employee's own location.
  const holidays = from && to && from <= to ? await holidaysFor(user, { from, to }) : [];
  const parsed = makeLeaveInputSchema(holidays).safeParse(body);
  if (!parsed.success) throw validationError(zodFields(parsed.error));
  const input = parsed.data;
  if (input.employeeName && input.employeeName.toLowerCase() !== user.name.toLowerCase()) {
    throw validationError(
      { employeeName: `Leave can only be requested for yourself (${user.name}).` },
      'The employee name does not match the signed-in user.',
    );
  }
  const b = leaveBreakdown(input.fromDate, input.toDate, holidays);
  return { ...input, days: b.days, excludedSundays: b.sundays, excludedHolidays: b.holidays };
}

const NO_DOCS_MSG = 'Supporting documents are only accepted for leave longer than 3 days. This request does not need one.';

/** Short leave neither needs nor accepts documents. */
function assertDocumentsAllowed(days, count) {
  if (count > 0 && !documentsAccepted(days)) throw validationError({ documents: NO_DOCS_MSG }, NO_DOCS_MSG);
}

const plusDays = (iso, n) => new Date(parseISODate(iso) + n * 86400000).toISOString().slice(0, 10);

/**
 * Leave in a row: the person's other active requests that touch this one (or are separated only by Sundays and holidays)
 * count together, so splitting a long leave into short requests does not skip the document or the second approval.
 */
export async function chainFor(user, fromDate, toDate, excludeId = null) {
  const lo = plusDays(fromDate, -31);
  const hi = plusDays(toDate, 31);
  const [others, hols] = await Promise.all([
    LeaveRequest.find(
      {
        employeeId: user.id,
        status: { $in: ACTIVE },
        fromDate: { $lte: hi },
        toDate: { $gte: lo },
        ...(excludeId ? { _id: { $ne: excludeId } } : {}),
      },
      { fromDate: 1, toDate: 1, days: 1 },
    ).lean(),
    holidaysFor(user, { from: lo, to: hi }),
  ]);
  return consecutiveChain(fromDate, toDate, others, hols);
}

/** A request is flagged when it is short on its own but joins other leave to make a long stretch: the split-up trick. */
const isSplit = (input, chain) => chain.members.length > 0 && absenceDays(input.fromDate, input.toDate) <= 3 && chain.absenceDays > 3;
const joined = (chain) => chain.members.map((m) => ({ requestId: m._id, fromDate: m.fromDate, toDate: m.toDate, days: m.days }));

const chainNote = (chain) =>
  chain.members.length
    ? ` Together with your other leave (${chain.members.map((m) => `${m.fromDate} to ${m.toDate}`).join(', ')}) this is ${chain.absenceDays} days in a row.`
    : '';

/** Emergency leaves that still owe documents. */
async function owedEmergencyLeaves(employeeId, excludeId) {
  const rows = await LeaveRequest.find({
    employeeId,
    isEmergency: true,
    isLong: true,
    status: { $in: ACTIVE },
    'documents.0': { $exists: false },
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  });
  return rows;
}

async function assertMayApply(employeeId, isEmergency, excludeId) {
  const owed = await owedEmergencyLeaves(employeeId, excludeId);
  const msg = emergencyBlockMessage(owed.length, isEmergency);
  if (msg) {
    const list = owed.map((o) => `${o.fromDate} to ${o.toDate}`).join('; ');
    throw new AppError(409, 'DOCUMENTS_OVERDUE', msg, `Upload documents for your emergency leave (${list}) from the request page.`);
  }
}

/** What the employee owes right now and what they may apply for. */
export async function getObligations(user) {
  const owed = await owedEmergencyLeaves(user.id);
  return {
    owed: owed.map((d) => ({
      id: String(d._id),
      fromDate: d.fromDate,
      toDate: d.toDate,
      dueBy: nextDay(d.toDate),
      overdue: nextDay(d.toDate) <= todayISO(),
    })),
    canApplyNormal: !emergencyBlockMessage(owed.length, false),
    canApplyEmergency: !emergencyBlockMessage(owed.length, true),
    message: emergencyBlockMessage(owed.length, false),
  };
}

async function assertNoOverlap(employeeId, fromDate, toDate, excludeId) {
  const clash = await LeaveRequest.findOne({
    employeeId,
    status: { $in: ACTIVE },
    fromDate: { $lte: toDate },
    toDate: { $gte: fromDate },
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  });
  if (clash) {
    throw new AppError(
      409,
      'OVERLAPPING_LEAVE',
      `These dates overlap with your leave from ${clash.fromDate} to ${clash.toDate}.`,
      'Pick different dates, or cancel the other request first.',
      { fromDate: 'Overlaps with another active request.' },
    );
  }
}

export async function createLeave(user, body, files) {
  if (user.role === 'EMPLOYEE' && !user.managerId) {
    throw new AppError(
      409,
      'NO_MANAGER',
      'Your account is not set up for leave yet.',
      'The Head of Department needs to choose your manager first. Ask them, and then try again.',
    );
  }
  const input = await parseLeaveInput(body, user);
  const prepared = prepareFiles(files);
  const chain = await chainFor(user, input.fromDate, input.toDate);
  assertDocumentsAllowed(chain.absenceDays, prepared.length);
  const docMsg = documentRequirementError(chain.absenceDays, prepared.length, input.isEmergency);
  if (docMsg) throw validationError({ documents: docMsg + chainNote(chain) }, docMsg + chainNote(chain));
  await assertNoOverlap(user.id, input.fromDate, input.toDate);
  await assertMayApply(user.id, input.isEmergency);
  await assertEnoughLeave(user.id, input.fromDate, input.days);

  const status = initialStatus(user.role);
  const timeline = [entry(user, 'SUBMITTED', null, status, `${input.isEmergency ? 'Emergency leave. ' : ''}${input.reason}`)];
  if (user.role === 'HOD') {
    timeline.push(entry(user, 'AUTO_APPROVED', 'APPROVED', 'APPROVED', 'HOD leave is auto-approved and flagged for audit.'));
  }
  const doc = await LeaveRequest.create({
    employeeId: user.id,
    employeeName: user.name,
    managerId: user.role === 'EMPLOYEE' ? user.managerId : null,
    fromDate: input.fromDate,
    toDate: input.toDate,
    days: input.days,
    excludedSundays: input.excludedSundays,
    excludedHolidays: input.excludedHolidays,
    chainDays: chain.chainDays,
    absenceDays: chain.absenceDays,
    splitFlag: isSplit(input, chain),
    joinedWith: joined(chain),
    isLong: isLongLeave(chain.absenceDays),
    reason: input.reason,
    isEmergency: input.isEmergency,
    status,
    documents: await storeFiles(prepared, user),
    timeline,
  });
  return serialize(doc, user);
}

async function load(id, user) {
  if (!mongoose.isValidObjectId(id)) throw notFound();
  const doc = await LeaveRequest.findById(id);
  if (!doc || !canView(doc, user)) throw notFound(); // 404 rather than 403: do not reveal existence
  return doc;
}

export async function getLeave(id, user) {
  return serialize(await load(id, user), user);
}

export async function listLeaves(user, { scope = 'mine', status, page = 1, pageSize = 20 }) {
  let filter;
  let sort = { createdAt: -1 };
  if (scope === 'mine') filter = { employeeId: user.id };
  else if (scope === 'queue') {
    if (user.role === 'EMPLOYEE')
      throw new AppError(403, 'FORBIDDEN', 'Only managers and the HOD have an approval queue.', 'Use "My requests" instead.');
    filter = user.role === 'HOD' ? { status: 'PENDING_HOD' } : { status: 'PENDING_MANAGER', managerId: user.id };
    sort = { createdAt: 1 };
  } else if (scope === 'all') {
    if (user.role === 'EMPLOYEE')
      throw new AppError(403, 'FORBIDDEN', 'Only managers and the HOD can see team requests.', 'Use "My requests" instead.');
    filter = visibilityFilter(user);
  } else throw validationError({ scope: 'Scope must be mine, queue or all.' });

  if (status) {
    if (!STATUSES.includes(status)) throw validationError({ status: 'Unknown status filter.' });
    if (scope !== 'queue') filter = { ...filter, status };
  }
  const size = Math.min(Math.max(Number(pageSize) || 20, 1), 50);
  const pg = Math.max(Number(page) || 1, 1);
  const [items, total] = await Promise.all([
    LeaveRequest.find(filter)
      .sort(sort)
      .skip((pg - 1) * size)
      .limit(size),
    LeaveRequest.countDocuments(filter),
  ]);
  return { items: items.map((d) => serialize(d, user)), total, page: pg, pageSize: size };
}

async function save(doc) {
  try {
    await doc.save();
  } catch (err) {
    if (err instanceof mongoose.Error.VersionError) {
      throw conflict(
        'STALE_REQUEST',
        'Someone else just updated this request.',
        'Refresh the page to see the latest version, then try again.',
      );
    }
    throw err;
  }
  return doc;
}

/** Runs a workflow action (approve/reject/request-info/reply/cancel) and records it on the timeline. */
export async function transition(id, user, action, { comment, expectedVersion, files } = {}) {
  const doc = await load(id, user);
  if (expectedVersion != null && Number(expectedVersion) !== doc.__v) {
    throw conflict(
      'STALE_REQUEST',
      'This request changed after you opened it.',
      'Refresh the page to see the latest version, then try again.',
    );
  }
  const prepared = action === 'REPLY' ? prepareFiles(files, doc.documents.length) : [];
  const next = applyAction(toSubject(doc), action, actorOf(user), todayISO());
  if (action === 'REPLY' && !comment && prepared.length === 0) {
    throw validationError({ message: 'Please write a reply or attach a document.' });
  }
  const from = doc.status;
  if (prepared.length) doc.documents.push(...(await storeFiles(prepared, user)));
  doc.status = next.status;
  doc.infoRequestedFrom = next.infoRequestedFrom;
  const note = prepared.length
    ? `${comment ?? ''}${comment ? ' ' : ''}(attached ${prepared.length} document${prepared.length > 1 ? 's' : ''})`
    : comment;
  doc.timeline.push(entry(user, action, from, next.status, note));
  await save(doc);
  return serialize(doc, user);
}

/** Employee edits dates/reason (and may add documents) before any approval has happened. */
export async function updateLeave(id, user, body, files) {
  const doc = await load(id, user);
  const input = await parseLeaveInput(body, user);
  const prepared = prepareFiles(files, doc.documents.length);
  const chain = await chainFor(user, input.fromDate, input.toDate, doc._id);
  assertDocumentsAllowed(chain.absenceDays, prepared.length);
  const isLong = isLongLeave(chain.absenceDays);
  const docMsg = documentRequirementError(chain.absenceDays, doc.documents.length + prepared.length, input.isEmergency);
  if (docMsg) throw validationError({ documents: docMsg + chainNote(chain) }, docMsg + chainNote(chain));
  applyAction(toSubject(doc), 'EDIT', actorOf(user), todayISO());
  await assertNoOverlap(user.id, input.fromDate, input.toDate, doc._id);
  await assertMayApply(user.id, input.isEmergency, doc._id);
  await assertEnoughLeave(user.id, input.fromDate, input.days, doc._id);

  doc.fromDate = input.fromDate;
  doc.toDate = input.toDate;
  doc.days = input.days;
  doc.excludedSundays = input.excludedSundays;
  doc.excludedHolidays = input.excludedHolidays;
  doc.chainDays = chain.chainDays;
  doc.absenceDays = chain.absenceDays;
  doc.splitFlag = isSplit(input, chain);
  doc.joinedWith = joined(chain);
  doc.isLong = isLong;
  doc.reason = input.reason;
  doc.isEmergency = input.isEmergency;
  if (prepared.length) doc.documents.push(...(await storeFiles(prepared, user)));
  doc.timeline.push(entry(user, 'EDIT', doc.status, doc.status, 'Request details updated.'));
  await save(doc);
  return serialize(doc, user);
}

/** Owner sends supporting documents later (e.g. after an emergency leave). */
export async function attachDocuments(id, user, files) {
  const doc = await load(id, user);
  const prepared = prepareFiles(files, doc.documents.length);
  if (prepared.length === 0) throw validationError({ documents: 'Please choose at least one PDF, JPG or PNG file.' });
  if (!doc.isLong) throw validationError({ documents: NO_DOCS_MSG }, NO_DOCS_MSG);
  applyAction(toSubject(doc), 'ATTACH', actorOf(user), todayISO());
  doc.documents.push(...(await storeFiles(prepared, user)));
  doc.timeline.push(
    entry(user, 'ATTACH', doc.status, doc.status, `Sent ${prepared.length} supporting document${prepared.length > 1 ? 's' : ''}.`),
  );
  await save(doc);
  return serialize(doc, user);
}

/** For the apply form: what these dates cost, and whether they join up with other leave to make a long stretch. */
export async function previewChain(user, { from, to, excludeId }) {
  if (parseISODate(from) === null || parseISODate(to) === null || from > to) {
    throw validationError({ from: 'Please give a start and an end date, start first (YYYY-MM-DD).' });
  }
  const holidays = await holidaysFor(user, { from, to });
  const own = leaveBreakdown(from, to, holidays).days;
  const chain = await chainFor(user, from, to, mongoose.isValidObjectId(excludeId) ? excludeId : null);
  return {
    days: own,
    chainDays: chain.chainDays,
    absenceDays: chain.absenceDays,
    members: chain.members.map((m) => ({ fromDate: m.fromDate, toDate: m.toDate, days: m.days })),
  };
}

/**
 * Who is away between two dates, plus the holidays that apply to the caller. Powers the team calendar.
 * HOD: everyone. Manager: their team and themselves. Employee: their own requests, and teammates' approved leave
 * (name and dates only: reasons and documents stay private).
 */
export async function calendar(user, { from, to }) {
  if (parseISODate(from) === null || parseISODate(to) === null || from > to) {
    throw validationError({ from: 'Please give a start and an end date, start first (YYYY-MM-DD).' });
  }
  if ((parseISODate(to) - parseISODate(from)) / 86400000 > 62) {
    throw validationError({ to: 'Please ask for at most about two months at a time.' });
  }
  let who;
  if (user.role === 'HOD') who = { status: { $in: ACTIVE } };
  else if (user.role === 'MANAGER') who = { status: { $in: ACTIVE }, $or: [{ managerId: user.id }, { employeeId: user.id }] };
  else {
    who = {
      $or: [
        { employeeId: user.id, status: { $in: ACTIVE } },
        ...(user.managerId ? [{ managerId: user.managerId, status: 'APPROVED' }] : []),
      ],
    };
  }
  const [rows, holidays] = await Promise.all([
    LeaveRequest.find({ ...who, fromDate: { $lte: to }, toDate: { $gte: from } })
      .sort({ fromDate: 1, employeeName: 1 })
      .limit(500)
      .lean(),
    listHolidays(user, { from, to }),
  ]);
  return {
    from,
    to,
    holidays,
    items: rows.map((d) => ({
      id: String(d._id),
      employeeId: sid(d.employeeId),
      employeeName: d.employeeName,
      fromDate: d.fromDate,
      toDate: d.toDate,
      days: d.days,
      status: d.status,
      isLong: d.isLong,
      mine: sid(d.employeeId) === user.id,
      canOpen: canView(d, user),
    })),
  };
}

/** Returns { stream, name, mimeType } after an access check. */
export async function openDocument(id, docId, user) {
  const doc = await load(id, user);
  const d = doc.documents.id(docId);
  if (!d) throw notFound();
  return { stream: storage.read(d.key), name: d.originalName, mimeType: d.mimeType };
}
