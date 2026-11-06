import { Router } from 'express';
import multer from 'multer';
import { MAX_FILES, MAX_FILE_BYTES, approveSchema, rejectSchema, infoRequestSchema, replySchema, zodFields } from '@lms/shared';
import { requireAuth } from '../middleware/auth.js';
import { validationError } from '../errors.js';
import * as svc from '../services/leaveService.js';
import { audit } from '../services/auditService.js';

export const leavesRouter = Router();
leavesRouter.use(requireAuth);

/** Records an audit entry for a completed request action using its latest timeline step. */
async function logResult(req, action, leave, detail) {
  const last = leave.timeline.at(-1);
  await audit(req, { action, entityId: leave.id, employeeName: leave.employeeName, fromStatus: last?.fromStatus, toStatus: leave.status, detail: detail ?? last?.comment });
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

leavesRouter.get('/chain', async (req, res) => {
  const { from, to, excludeId } = req.query;
  res.json(await svc.previewChain(req.user, { from: String(from ?? ''), to: String(to ?? ''), excludeId: typeof excludeId === 'string' ? excludeId : null }));
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
  await logResult(req, 'LEAVE_SUBMITTED', leave, `${leave.days} day(s)${leave.isEmergency ? ', emergency' : ''}${leave.isLong ? ', long leave' : ''}; ${docCount(req) ?? 'no documents'}${req.user.role === 'HOD' ? '; HOD leave auto-approved' : ''}`);
  res.status(201).json(leave);
});

leavesRouter.get('/:id', async (req, res) => {
  res.json(await svc.getLeave(req.params.id, req.user));
});

leavesRouter.patch('/:id', upload, async (req, res) => {
  const leave = await svc.updateLeave(req.params.id, req.user, req.body, req.files);
  await logResult(req, 'LEAVE_EDITED', leave, docCount(req));
  res.json(leave);
});

const decision = (path, action, schema) =>
  leavesRouter.post(path, async (req, res) => {
    const { comment } = parse(schema, req.body);
    const leave = await svc.transition(req.params.id, req.user, action, { comment, expectedVersion: req.body?.version });
    await logResult(req, `LEAVE_${action}`, leave);
    res.json(leave);
  });

decision('/:id/approve', 'APPROVE', approveSchema);
decision('/:id/reject', 'REJECT', rejectSchema);
decision('/:id/request-info', 'REQUEST_INFO', infoRequestSchema);

leavesRouter.post('/:id/cancel', async (req, res) => {
  const leave = await svc.transition(req.params.id, req.user, 'CANCEL', { comment: req.body?.comment });
  await logResult(req, 'LEAVE_CANCEL', leave);
  res.json(leave);
});

leavesRouter.post('/:id/reply', upload, async (req, res) => {
  const { message } = parse(replySchema, req.body);
  const leave = await svc.transition(req.params.id, req.user, 'REPLY', { comment: message, files: req.files });
  await logResult(req, 'LEAVE_REPLY', leave, docCount(req));
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
