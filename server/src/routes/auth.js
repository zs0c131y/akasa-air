import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { User } from '../models/User.js';
import { AppError } from '../errors.js';
import { config } from '../config.js';
import { requireAuth, startSession, rotateSession, endSession } from '../middleware/auth.js';
import { audit } from '../services/auditService.js';

const makeLoginLimiter = () =>
  rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: () => config.loginRateMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) =>
    next(new AppError(429, 'TOO_MANY_REQUESTS', 'Too many sign-in attempts from this device.', 'Please wait a few minutes and try again.')),
  });

const publicUser = (u) => ({ id: String(u._id), name: u.name, email: u.email, role: u.role });
const asActor = (u) => ({ id: String(u._id), name: u.name, role: u.role });

/** Builds the auth router (its sign-in rate limiter is per app instance). */
export function createAuthRouter() {
  const authRouter = Router();
  const loginLimiter = makeLoginLimiter();

  authRouter.post('/login', loginLimiter, async (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!email || !password) {
      throw new AppError(400, 'VALIDATION_FAILED', 'Please enter your email and password.', '', {
        ...(email ? {} : { email: 'Email is required.' }),
        ...(password ? {} : { password: 'Password is required.' }),
      });
    }
    const user = await User.findOne({ email });
    if (user?.lockUntil && user.lockUntil > new Date()) {
      const mins = Math.ceil((user.lockUntil - Date.now()) / 60000);
      await audit(req, { action: 'LOGIN_BLOCKED', actor: asActor(user), detail: 'Sign-in attempt while account is locked' });
      throw new AppError(423, 'ACCOUNT_LOCKED', `This account is locked after too many wrong passwords. Try again in ${mins} minute${mins > 1 ? 's' : ''}.`, 'Wrong password? Wait for the lock to end.');
    }
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      if (user) {
        user.failedLogins += 1;
        if (user.failedLogins >= config.maxFailedLogins) {
          user.failedLogins = 0;
          user.lockUntil = new Date(Date.now() + config.lockMinutes * 60000);
        }
        await user.save();
      }
      await audit(req, { action: 'LOGIN_FAILED', actor: user ? asActor(user) : null, detail: `Failed sign-in for ${email}` });
      throw new AppError(401, 'BAD_CREDENTIALS', 'That email and password do not match.', 'Check for typos and try again.');
    }
    user.failedLogins = 0;
    user.lockUntil = null;
    await user.save();
    const token = await startSession(res, user);
    await audit(req, { action: 'LOGIN', actor: asActor(user) });
    // `token` is for API clients/tests; the browser app uses the httpOnly cookies instead.
    res.json({ token, user: publicUser(user) });
  });

  authRouter.post('/refresh', async (req, res) => {
    const user = await rotateSession(req, res);
    res.json({ user: publicUser(user) });
  });

  authRouter.post('/logout', async (req, res) => {
    await endSession(req, res);
    res.json({ ok: true });
  });

  authRouter.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));
  return authRouter;
}
