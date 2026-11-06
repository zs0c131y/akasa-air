import mongoose from 'mongoose';
import {
  MAX_FILES,
  MAX_FILE_BYTES,
  ALLOWED_MIME,
  STATUSES,
  countLeaveDays,
  isLongLeave,
  documentRequirementError,
  emergencyBlockMessage,
  leaveInputSchema,
  todayISO,
  parseISODate,
  zodFields,
} from '@lms/shared';
import { LeaveRequest } from '../models/LeaveRequest.js';
import { AppError, notFound, conflict, validationError } from '../errors.js';
import { storage, sniffMime, safeFilename } from '../storage/index.js';
import { allowedActions, applyAction, initialStatus } from '../workflow.js';

const ACTIVE = ['PENDING_MANAGER', 'PENDING_HOD', 'INFO_REQUESTED', 'APPROVED'];

/** True when an emergency leave over the threshold was filed without any document yet. */
const owesDocuments = (d) => d.isEmergency && d.isLong && d.documents.length === 0 && ACTIVE.includes(d.status);
const nextDay = (iso) => new Date(parseISODate(iso) + 86400000).toISOString().slice(0, 10);

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

function parseLeaveInput(body, user) {
  const parsed = leaveInputSchema.safeParse(body);
  if (!parsed.success) throw validationError(zodFields(parsed.error));
  const input = parsed.data;
  if (input.employeeName && input.employeeName.toLowerCase() !== user.name.toLowerCase()) {
    throw validationError(
      { employeeName: `Leave can only be requested for yourself (${user.name}).` },
      'The employee name does not match the signed-in user.',
    );
  }
  return { ...input, days: countLeaveDays(input.fromDate, input.toDate) };
}

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
    owed: owed.map((d) => ({ id: String(d._id), fromDate: d.fromDate, toDate: d.toDate, dueBy: nextDay(d.toDate), overdue: nextDay(d.toDate) <= todayISO() })),
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
  const input = parseLeaveInput(body, user);
  const prepared = prepareFiles(files);
  const docMsg = documentRequirementError(input.days, prepared.length, input.isEmergency);
  if (docMsg) throw validationError({ documents: docMsg }, docMsg);
  await assertNoOverlap(user.id, input.fromDate, input.toDate);
  await assertMayApply(user.id, input.isEmergency);

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
    isLong: isLongLeave(input.days),
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
    if (user.role === 'EMPLOYEE') throw new AppError(403, 'FORBIDDEN', 'Only managers and the HOD have an approval queue.', 'Use "My requests" instead.');
    filter = user.role === 'HOD' ? { status: 'PENDING_HOD' } : { status: 'PENDING_MANAGER', managerId: user.id };
    sort = { createdAt: 1 };
  } else if (scope === 'all') {
    if (user.role === 'EMPLOYEE') throw new AppError(403, 'FORBIDDEN', 'Only managers and the HOD can see team requests.', 'Use "My requests" instead.');
    filter = visibilityFilter(user);
  } else throw validationError({ scope: 'Scope must be mine, queue or all.' });

  if (status) {
    if (!STATUSES.includes(status)) throw validationError({ status: 'Unknown status filter.' });
    if (scope !== 'queue') filter = { ...filter, status };
  }
  const size = Math.min(Math.max(Number(pageSize) || 20, 1), 50);
  const pg = Math.max(Number(page) || 1, 1);
  const [items, total] = await Promise.all([
    LeaveRequest.find(filter).sort(sort).skip((pg - 1) * size).limit(size),
    LeaveRequest.countDocuments(filter),
  ]);
  return { items: items.map((d) => serialize(d, user)), total, page: pg, pageSize: size };
}

async function save(doc) {
  try {
    await doc.save();
  } catch (err) {
    if (err instanceof mongoose.Error.VersionError) {
      throw conflict('STALE_REQUEST', 'Someone else just updated this request.', 'Refresh the page to see the latest version, then try again.');
    }
    throw err;
  }
  return doc;
}

/** Runs a workflow action (approve/reject/request-info/reply/cancel) and records it on the timeline. */
export async function transition(id, user, action, { comment, expectedVersion, files } = {}) {
  const doc = await load(id, user);
  if (expectedVersion != null && Number(expectedVersion) !== doc.__v) {
    throw conflict('STALE_REQUEST', 'This request changed after you opened it.', 'Refresh the page to see the latest version, then try again.');
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
  const note = prepared.length ? `${comment ?? ''}${comment ? ' ' : ''}(attached ${prepared.length} document${prepared.length > 1 ? 's' : ''})` : comment;
  doc.timeline.push(entry(user, action, from, next.status, note));
  await save(doc);
  return serialize(doc, user);
}

/** Employee edits dates/reason (and may add documents) before any approval has happened. */
export async function updateLeave(id, user, body, files) {
  const doc = await load(id, user);
  const input = parseLeaveInput(body, user);
  const prepared = prepareFiles(files, doc.documents.length);
  const isLong = isLongLeave(input.days);
  const docMsg = documentRequirementError(input.days, doc.documents.length + prepared.length, input.isEmergency);
  if (docMsg) throw validationError({ documents: docMsg }, docMsg);
  applyAction(toSubject(doc), 'EDIT', actorOf(user), todayISO());
  await assertNoOverlap(user.id, input.fromDate, input.toDate, doc._id);
  await assertMayApply(user.id, input.isEmergency, doc._id);

  doc.fromDate = input.fromDate;
  doc.toDate = input.toDate;
  doc.days = input.days;
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
  applyAction(toSubject(doc), 'ATTACH', actorOf(user), todayISO());
  doc.documents.push(...(await storeFiles(prepared, user)));
  doc.timeline.push(entry(user, 'ATTACH', doc.status, doc.status, `Sent ${prepared.length} supporting document${prepared.length > 1 ? 's' : ''}.`));
  await save(doc);
  return serialize(doc, user);
}

/** Returns { stream, name, mimeType } after an access check. */
export async function openDocument(id, docId, user) {
  const doc = await load(id, user);
  const d = doc.documents.id(docId);
  if (!d) throw notFound();
  return { stream: storage.read(d.key), name: d.originalName, mimeType: d.mimeType };
}
