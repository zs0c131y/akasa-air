import { Router } from 'express';
import multer from 'multer';
import {
  MAX_FILES,
  MAX_FILE_BYTES,
  approveSchema,
  cancelSchema,
  rejectSchema,
  infoRequestSchema,
  replySchema,
  zodFields,
} from '@lms/shared';
import { requireAuth } from '../middleware/auth.js';
import { validationError } from '../errors.js';
import * as svc from '../services/leaveService.js';
import { audit } from '../services/auditService.js';
import { notifyLeaveEvent } from '../services/notificationService.js';

export const leavesRouter = Router();
leavesRouter.use(requireAuth);

/** Records an audit entry for a completed request action using its latest timeline step. */
async function logResult(req, action, leave, detail) {
  const last = leave.timeline.at(-1);
  await audit(req, {
    action,
    entityId: leave.id,
    employeeName: leave.employeeName,
    fromStatus: last?.fromStatus,
    toStatus: leave.status,
    detail: detail ?? last?.comment,
  });
}
/** A request that is short alone but joins other leave into a stretch over 3 days is recorded for the HOD to see. */
async function flagSplit(req, leave) {
  const others = leave.joinedWith.map((j) => `${j.fromDate} to ${j.toDate}`).join(', ');
  await audit(req, {
    action: 'SPLIT_LEAVE_FLAGGED',
    entityId: leave.id,
    employeeName: leave.employeeName,
    detail: `${leave.fromDate} to ${leave.toDate} follows ${others}: ${leave.absenceDays} days in a row`,
  });
}
const docCount = (req) => (req.files?.length ? `${req.files.length} document(s) uploaded` : undefined);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: MAX_FILES + 1 },
}).array('documents', MAX_FILES + 1);

/** Parse the body of a JSON or schema-checked form. */
function parse(schema, body) {
  const r = schema.safeParse(body ?? {});
  if (!r.success) throw validationError(zodFields(r.error));
  return r.data;
}

leavesRouter.get('/export.csv', async (req, res) => {
  const q = req.query;
  const s = (v) => (typeof v === 'string' && v ? v : undefined);
  const { csv, count } = await svc.exportCsv(req.user, { scope: s(q.scope), status: s(q.status), from: s(q.from), to: s(q.to) });
  await audit(req, { action: 'LEAVE_EXPORTED', detail: `${count} request(s), ${s(q.scope) ?? 'mine'}` });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="leave-requests-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(csv);
});

leavesRouter.get('/chain', async (req, res) => {
  const { from, to, excludeId } = req.query;
  res.json(
    await svc.previewChain(req.user, {
      from: String(from ?? ''),
      to: String(to ?? ''),
      excludeId: typeof excludeId === 'string' ? excludeId : null,
    }),
  );
});

leavesRouter.get('/calendar', async (req, res) => {
  res.json(await svc.calendar(req.user, { from: String(req.query.from ?? ''), to: String(req.query.to ?? '') }));
});

leavesRouter.get('/obligations', async (req, res) => {
  res.json(await svc.getObligations(req.user));
});

leavesRouter.get('/', async (req, res) => {
  res.json(await svc.listLeaves(req.user, req.query));
});

leavesRouter.post('/', upload, async (req, res) => {
  const leave = await svc.createLeave(req.user, req.body, req.files);
  await logResult(
    req,
    'LEAVE_SUBMITTED',
    leave,
    `${leave.days} day(s)${leave.isEmergency ? ', emergency' : ''}${leave.isLong ? ', long leave' : ''}; ${docCount(req) ?? 'no documents'}${req.user.role === 'HOD' ? '; HOD leave auto-approved' : ''}`,
  );
  if (leave.splitFlag) await flagSplit(req, leave);
  if (leave.timeline.some((t) => t.action === 'REROUTED')) {
    await audit(req, {
      action: 'LEAVE_REROUTED',
      entityId: leave.id,
      employeeName: leave.employeeName,
      detail: 'Manager is on leave: sent straight to the HOD',
    });
  }
  await notifyLeaveEvent('SUBMITTED', leave.id, req.user);
  res.status(201).json(leave);
});

leavesRouter.get('/:id', async (req, res) => {
  res.json(await svc.getLeave(req.params.id, req.user));
});

leavesRouter.patch('/:id', upload, async (req, res) => {
  const leave = await svc.updateLeave(req.params.id, req.user, req.body, req.files);
  await logResult(req, 'LEAVE_EDITED', leave, docCount(req));
  if (leave.splitFlag) await flagSplit(req, leave);
  res.json(leave);
});

const decision = (path, action, schema) =>
  leavesRouter.post(path, async (req, res) => {
    const { comment } = parse(schema, req.body);
    const leave = await svc.transition(req.params.id, req.user, action, { comment, expectedVersion: req.body?.version });
    await logResult(req, `LEAVE_${action}`, leave);
    await notifyLeaveEvent(action, leave.id, req.user);
    for (const id of leave.rerouted ?? []) {
      await audit(req, { action: 'LEAVE_REROUTED', entityId: id, detail: 'Manager is on leave: sent straight to the HOD' });
      await notifyLeaveEvent('REROUTED', id, req.user);
    }
    res.json(leave);
  });

decision('/:id/approve', 'APPROVE', approveSchema);
decision('/:id/reject', 'REJECT', rejectSchema);
decision('/:id/request-info', 'REQUEST_INFO', infoRequestSchema);

leavesRouter.post('/:id/cancel', async (req, res) => {
  const { comment } = parse(cancelSchema, req.body);
  const leave = await svc.transition(req.params.id, req.user, 'CANCEL', { comment });
  await logResult(req, 'LEAVE_CANCEL', leave);
  await notifyLeaveEvent('CANCEL', leave.id, req.user);
  res.json(leave);
});

leavesRouter.post('/:id/reply', upload, async (req, res) => {
  const { message } = parse(replySchema, req.body);
  const leave = await svc.transition(req.params.id, req.user, 'REPLY', { comment: message, files: req.files });
  await logResult(req, 'LEAVE_REPLY', leave, docCount(req));
  await notifyLeaveEvent('REPLY', leave.id, req.user);
  res.json(leave);
});

leavesRouter.post('/:id/documents', upload, async (req, res) => {
  const leave = await svc.attachDocuments(req.params.id, req.user, req.files);
  await logResult(req, 'DOCUMENT_UPLOADED', leave, docCount(req));
  res.json(leave);
});

leavesRouter.get('/:id/documents/:docId', async (req, res) => {
  const { stream, name, mimeType } = await svc.openDocument(req.params.id, req.params.docId, req.user);
  await audit(req, { action: 'DOCUMENT_VIEWED', entityId: req.params.id, detail: name });
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Disposition', `inline; filename="${name.replace(/"/g, '')}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-store');
  stream.on('error', () => res.destroy());
  stream.pipe(res);
});
