import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { User } from '../models/User.js';
import { AppError } from '../errors.js';
import { config } from '../config.js';
import { requireAuth, startSession, rotateSession, endSession } from '../middleware/auth.js';
import { audit } from '../services/auditService.js';
import { signupSchema, forgotSchema, resetSchema, changePasswordSchema, zodFields } from '@lms/shared';
import { validationError } from '../errors.js';
import {
  changePassword,
  checkResetToken,
  confirmEmail,
  requestReset,
  resendVerification,
  resetPassword,
  signUp,
} from '../services/accountService.js';
import { isMailConfigured } from '../services/mail.js';
import { balanceFor } from '../services/allowanceService.js';

const makeLoginLimiter = () =>
  rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: () => config.loginRateMax,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, _res, next) =>
      next(
        new AppError(429, 'TOO_MANY_REQUESTS', 'Too many sign-in attempts from this device.', 'Please wait a few minutes and try again.'),
      ),
  });

/** A limiter for the account endpoints, one set per app instance like the sign-in limiter. */
const makeLimiter = (limit, windowMs, message) =>
  rateLimit({
    windowMs,
    limit: () => (process.env.NODE_ENV === 'test' ? 1000 : limit),
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, _res, next) => next(new AppError(429, 'TOO_MANY_REQUESTS', message, 'Please wait a little and try again.')),
  });

const parse = (schema, body) => {
  const r = schema.safeParse(body ?? {});
  if (!r.success) throw validationError(zodFields(r.error));
  return r.data;
};

const publicUser = (u) => ({
  id: String(u._id),
  name: u.name,
  email: u.email,
  role: u.role,
  location: u.location ?? null,
  employeeCode: u.employeeCode ?? null,
  department: u.department ?? null,
  joinedAt: u.createdAt ?? null,
  emailVerified: u.emailVerified !== false,
  emailNotifications: u.emailNotifications !== false,
});

/** Everything the profile and account menu show: the basics plus who you report to and your leave balance. */
async function fullProfile(u) {
  const boss = u.managerId ? await User.findById(u.managerId, { name: 1, role: 1 }).lean() : null;
  return { ...publicUser(u), managerName: boss?.name ?? null, balance: await balanceFor(u._id) };
}
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
      throw new AppError(
        423,
        'ACCOUNT_LOCKED',
        `This account is locked after too many wrong passwords. Try again in ${mins} minute${mins > 1 ? 's' : ''}.`,
        'Wrong password? Wait for the lock to end.',
      );
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
    if (!user.emailVerified) {
      throw new AppError(
        403,
        'EMAIL_NOT_VERIFIED',
        'Please confirm your email before signing in.',
        'We sent you a link when you signed up. Use "Send it again" if you cannot find it.',
      );
    }
    user.failedLogins = 0;
    user.lockUntil = null;
    await user.save();
    const token = await startSession(res, user);
    await audit(req, { action: 'LOGIN', actor: asActor(user) });
    // `token` is for API clients/tests; the browser app uses the httpOnly cookies instead.
    res.json({ token, user: await fullProfile(user) });
  });

  authRouter.post('/refresh', async (req, res) => {
    const user = await rotateSession(req, res);
    res.json({ user: await fullProfile(user) });
  });

  authRouter.post('/logout', async (req, res) => {
    await endSession(req, res);
    res.json({ ok: true });
  });

  const signupLimiter = makeLimiter(10, 60 * 60 * 1000, 'Too many sign-ups from this device.');
  const mailLimiter = makeLimiter(6, 15 * 60 * 1000, 'Too many requests from this device.');

  /** Anyone can sign up as an employee. The HOD then sets their manager and location before they can apply. */
  authRouter.post('/signup', signupLimiter, async (req, res) => {
    const input = parse(signupSchema, req.body);
    const { user, needsVerification } = await signUp(input);
    await audit(req, {
      action: 'SIGNUP',
      actor: asActor(user),
      detail: needsVerification ? 'Waiting for email confirmation' : 'Account created',
    });
    res.status(201).json({
      ok: true,
      needsVerification,
      message: needsVerification
        ? 'Almost there. We sent a link to your email. Open it to confirm your address.'
        : 'Your account is ready. You can sign in now.',
    });
  });

  authRouter.post('/verify-email', mailLimiter, async (req, res) => {
    const user = await confirmEmail(req.body?.token);
    await audit(req, { action: 'EMAIL_CONFIRMED', actor: asActor(user) });
    res.json({ ok: true });
  });

  /** Same answer whether or not the address has an account, so this cannot be used to look people up. */
  authRouter.post('/resend-verification', mailLimiter, async (req, res) => {
    const { email } = parse(forgotSchema, req.body);
    await resendVerification(email);
    res.json({ ok: true, message: 'If that address is waiting for confirmation, we have sent the link again.' });
  });

  authRouter.post('/forgot-password', mailLimiter, async (req, res) => {
    const { email } = parse(forgotSchema, req.body);
    const user = await requestReset(email);
    if (user) await audit(req, { action: 'PASSWORD_RESET_REQUESTED', actor: asActor(user) });
    res.json({
      ok: true,
      message: 'If there is an account for that address, we have sent a link to choose a new password. It works for 60 minutes.',
    });
  });

  authRouter.post('/check-reset', mailLimiter, async (req, res) => {
    res.json({ valid: await checkResetToken(typeof req.body?.token === 'string' ? req.body.token : '') });
  });

  authRouter.post('/reset-password', mailLimiter, async (req, res) => {
    const { token, password } = parse(resetSchema, req.body);
    const user = await resetPassword(token, password);
    await audit(req, { action: 'PASSWORD_RESET', actor: asActor(user) });
    res.json({ ok: true });
  });

  authRouter.post('/change-password', requireAuth, async (req, res) => {
    const { currentPassword, newPassword } = parse(changePasswordSchema, req.body);
    const user = await changePassword(req.user.id, currentPassword, newPassword);
    await audit(req, { action: 'PASSWORD_CHANGED', actor: asActor(user) });
    await startSession(res, user); // other devices are signed out; this one stays in
    res.json({ ok: true });
  });

  /** Tells the sign-up page whether it will email a link (so it can say what to expect). */
  authRouter.get('/options', (_req, res) => res.json({ emailEnabled: isMailConfigured() }));

  authRouter.get('/me', requireAuth, async (req, res) => {
    const u = await User.findById(req.user.id);
    res.json({ user: await fullProfile(u) });
  });
  return authRouter;
}
