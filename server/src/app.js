import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { zodFields, MAX_FILE_BYTES, MAX_FILES } from '@lms/shared';
import { config } from './config.js';
import { AppError } from './errors.js';
import { createAuthRouter } from './routes/auth.js';
import { leavesRouter } from './routes/leaves.js';
import { auditRouter } from './routes/audit.js';
import { holidaysRouter, locationsRouter, peopleRouter } from './routes/holidays.js';
import { statsRouter } from './routes/stats.js';
import { audit } from './services/auditService.js';
import { securityHeaders, corsAllowlist, apiLimiter, rejectOperatorKeys, requestLogger } from './middleware/security.js';

/** Builds the Express app (no listening, so tests can use it directly). */
export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', config.trustProxy);
  app.use(requestLogger);
  app.use(securityHeaders());
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (_req, res) =>
    res.json({ status: 'ok', db: mongoose.connection.readyState === 1 ? 'up' : 'down' }),
  );
  app.use('/api', corsAllowlist, apiLimiter(), rejectOperatorKeys);
  app.use('/api/auth', createAuthRouter());
  app.use('/api/leaves', leavesRouter);
  app.use('/api/audit', auditRouter);
  app.use('/api/holidays', holidaysRouter);
  app.use('/api/locations', locationsRouter);
  app.use('/api/people', peopleRouter);
  app.use('/api/stats', statsRouter);
  app.use('/api', (_req, _res, next) => next(new AppError(404, 'NOT_FOUND', 'That page of the API does not exist.')));

  const dist = config.clientDist;
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get(/^(?!\/api|\/health).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}

function errorHandler(err, req, res, _next) {
  let e = err;
  if (err instanceof ZodError) {
    e = new AppError(400, 'VALIDATION_FAILED', 'Some details need fixing.', 'Check the highlighted fields.', zodFields(err));
  } else if (err instanceof multer.MulterError) {
    const msgs = {
      LIMIT_FILE_SIZE: `A file is larger than ${MAX_FILE_BYTES / 1024 / 1024} MB. Please attach a smaller file.`,
      LIMIT_FILE_COUNT: `You can attach at most ${MAX_FILES} documents.`,
      LIMIT_UNEXPECTED_FILE: 'Unexpected file field. Please use the document picker.',
    };
    e = new AppError(400, 'UPLOAD_FAILED', msgs[err.code] ?? 'The upload failed.', 'Check the file and try again.', { documents: msgs[err.code] });
  } else if (err?.type === 'entity.parse.failed') {
    e = new AppError(400, 'BAD_JSON', 'We could not read that request.', 'Please try again.');
  }
  if (!(e instanceof AppError)) {
    console.error('[error]', err);
    e = new AppError(500, 'INTERNAL', 'Something went wrong on our side.', 'Please try again in a moment. If it keeps happening, contact support.');
  }
  if (req.user && (e.status === 403 || (e.status === 404 && req.originalUrl.startsWith('/api/leaves')))) {
    audit(req, { action: 'ACCESS_DENIED', detail: `${req.method} ${req.originalUrl.split('?')[0]} -> ${e.status}` });
  }
  res.status(e.status).json({ error: { code: e.code, message: e.message, hint: e.hint, fields: e.fields } });
}
