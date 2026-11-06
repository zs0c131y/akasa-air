import { randomUUID } from 'node:crypto';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from '../config.js';
import { AppError } from '../errors.js';

/** Security headers incl. a strict Content-Security-Policy (the app loads only same-origin scripts/styles). */
export const securityHeaders = () =>
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'script-src': ["'self'"],
        'style-src': ["'self'"],
        'img-src': ["'self'", 'data:', 'blob:'],
        'object-src': ["'none'"],
        'frame-ancestors': ["'none'"],
        'upgrade-insecure-requests': config.isProd ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
  });

/** Same-origin requests pass; other browser origins must be listed in CORS_ORIGINS. */
export function corsAllowlist(req, res, next) {
  const origin = req.headers.origin;
  if (!origin) return next();
  let sameOrigin = false;
  try {
    sameOrigin = new URL(origin).host === req.headers.host;
  } catch {
    /* malformed origin falls through to the block below */
  }
  if (sameOrigin) return next();
  if (config.corsOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
    res.setHeader('Vary', 'Origin');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    return next();
  }
  next(new AppError(403, 'CORS_BLOCKED', 'This website is not allowed to use the API.', 'Open the app from its official address.'));
}

export const apiLimiter = () =>
  rateLimit({
    windowMs: 60 * 1000,
    limit: () => config.apiRateMax,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, _res, next) =>
      next(new AppError(429, 'TOO_MANY_REQUESTS', 'You are doing that too quickly.', 'Please wait a moment and try again.')),
  });

/** Rejects keys containing "$" or "." (e.g. "$ne", "a.b") in JSON bodies and query strings (NoSQL operator injection). */
export function rejectOperatorKeys(req, _res, next) {
  const bad = (v, depth = 0) => {
    if (!v || typeof v !== 'object' || depth > 6) return false;
    return Object.keys(v).some((k) => k.includes('$') || k.includes('.') || bad(v[k], depth + 1));
  };
  if (bad(req.body) || bad(req.query)) {
    return next(new AppError(400, 'BAD_INPUT', 'That request contains characters we cannot accept.', 'Remove special characters like $ and try again.'));
  }
  next();
}

/** Adds an X-Request-Id and writes one structured JSON log line per request. */
export function requestLogger(req, res, next) {
  req.id = req.headers['x-request-id']?.toString().slice(0, 64) || randomUUID();
  res.setHeader('X-Request-Id', req.id);
  if (!config.logRequests) return next();
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    console.log(JSON.stringify({ t: new Date().toISOString(), id: req.id, method: req.method, path: req.originalUrl.split('?')[0], status: res.statusCode, ms: Math.round(ms), user: req.user?.id }));
  });
  next();
}
