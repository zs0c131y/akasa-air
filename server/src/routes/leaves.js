import { Router } from 'express';
import multer from 'multer';
import { MAX_FILES, MAX_FILE_BYTES, approveSchema, rejectSchema, infoRequestSchema, replySchema, zodFields } from '@lms/shared';
import { requireAuth } from '../middleware/auth.js';
import { validationError } from '../errors.js';
import * as svc from '../services/leaveService.js';

export const leavesRouter = Router();
leavesRouter.use(requireAuth);

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

leavesRouter.get('/obligations', async (req, res) => {
  res.json(await svc.getObligations(req.user));
});

leavesRouter.get('/', async (req, res) => {
  res.json(await svc.listLeaves(req.user, req.query));
});

leavesRouter.post('/', upload, async (req, res) => {
  res.status(201).json(await svc.createLeave(req.user, req.body, req.files));
});

leavesRouter.get('/:id', async (req, res) => {
  res.json(await svc.getLeave(req.params.id, req.user));
});

leavesRouter.patch('/:id', upload, async (req, res) => {
  res.json(await svc.updateLeave(req.params.id, req.user, req.body, req.files));
});

const decision = (path, action, schema) =>
  leavesRouter.post(path, async (req, res) => {
    const { comment } = parse(schema, req.body);
    res.json(await svc.transition(req.params.id, req.user, action, { comment, expectedVersion: req.body?.version }));
  });

decision('/:id/approve', 'APPROVE', approveSchema);
decision('/:id/reject', 'REJECT', rejectSchema);
decision('/:id/request-info', 'REQUEST_INFO', infoRequestSchema);

leavesRouter.post('/:id/cancel', async (req, res) => {
  res.json(await svc.transition(req.params.id, req.user, 'CANCEL', { comment: req.body?.comment }));
});

leavesRouter.post('/:id/reply', upload, async (req, res) => {
  const { message } = parse(replySchema, req.body);
  res.json(await svc.transition(req.params.id, req.user, 'REPLY', { comment: message, files: req.files }));
});

leavesRouter.post('/:id/documents', upload, async (req, res) => {
  res.json(await svc.attachDocuments(req.params.id, req.user, req.files));
});

leavesRouter.get('/:id/documents/:docId', async (req, res) => {
  const { stream, name, mimeType } = await svc.openDocument(req.params.id, req.params.docId, req.user);
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Disposition', `inline; filename="${name.replace(/"/g, '')}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-store');
  stream.on('error', () => res.destroy());
  stream.pipe(res);
});
