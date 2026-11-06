import jwt from 'jsonwebtoken';
import { createHash, randomBytes } from 'node:crypto';
import { config } from '../config.js';
import { User } from '../models/User.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { AppError } from '../errors.js';

export const ACCESS_COOKIE = 'lms_access';
export const REFRESH_COOKIE = 'lms_refresh';
const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

export function signToken(user) {
  return jwt.sign({ sub: String(user._id) }, config.jwtSecret, { expiresIn: config.accessTtl });
}

const unauthorized = (message = 'Please sign in to continue.', hint = 'Your session may have expired.') =>
  new AppError(401, 'UNAUTHENTICATED', message, hint);

const hash = (token) => createHash('sha256').update(token).digest('hex');

function readCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

const cookieOpts = (maxAgeMs, path = '/') => ({
  httpOnly: true,
  secure: config.isProd && process.env.COOKIE_SECURE !== 'false',
  sameSite: 'lax',
  path,
  maxAge: maxAgeMs,
});

/** Sets the httpOnly access + refresh cookies and stores the refresh token hash. Returns the access token. */
export async function startSession(res, user) {
  const access = signToken(user);
  const refresh = randomBytes(32).toString('hex');
  const ttl = config.refreshDays * 86400000;
  await RefreshToken.create({ userId: user._id, tokenHash: hash(refresh), expiresAt: new Date(Date.now() + ttl) });
  res.cookie(ACCESS_COOKIE, access, cookieOpts(15 * 60 * 1000));
  res.cookie(REFRESH_COOKIE, refresh, cookieOpts(ttl, '/api/auth'));
  return access;
}

/**
 * Exchanges a valid refresh token for new tokens and revokes the old one (rotation).
 * Presenting an already-used token revokes every session of that user (theft detection).
 */
export async function rotateSession(req, res) {
  const token = readCookies(req)[REFRESH_COOKIE];
  if (!token) throw unauthorized();
  const row = await RefreshToken.findOne({ tokenHash: hash(token) });
  if (!row || row.expiresAt < new Date()) throw unauthorized();
  if (row.revokedAt) {
    await RefreshToken.updateMany({ userId: row.userId, revokedAt: null }, { revokedAt: new Date() });
    throw unauthorized('Your session was closed for safety.', 'Please sign in again.');
  }
  const user = await User.findById(row.userId);
  if (!user) throw unauthorized();
  row.revokedAt = new Date();
  await row.save();
  await startSession(res, user);
  return user;
}

export async function endSession(req, res) {
  const token = readCookies(req)[REFRESH_COOKIE];
  if (token) await RefreshToken.updateOne({ tokenHash: hash(token), revokedAt: null }, { revokedAt: new Date() });
  res.clearCookie(ACCESS_COOKIE, { path: '/' });
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
}

/**
 * Loads the signed-in user onto req.user from a Bearer token (API clients) or the httpOnly cookie (browser).
 * Cookie-authenticated writes must carry `X-Requested-With: lms` (CSRF defence on top of SameSite).
 */
export async function requireAuth(req, _res, next) {
  const header = req.headers.authorization ?? '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : null;
  const cookieToken = readCookies(req)[ACCESS_COOKIE];
  const token = bearer ?? cookieToken;
  if (!token) throw unauthorized();
  if (!bearer && !SAFE_METHODS.includes(req.method) && req.headers['x-requested-with'] !== 'lms') {
    throw new AppError(403, 'CSRF_BLOCKED', 'This request was blocked for your safety.', 'Reload the page and try again.');
  }
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    throw unauthorized();
  }
  const user = await User.findById(payload.sub);
  if (!user) throw unauthorized();
  req.user = {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    managerId: user.managerId ? String(user.managerId) : null,
    location: user.location ?? null,
  };
  next();
}
