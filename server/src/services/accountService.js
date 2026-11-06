import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { passwordProblem } from '@lms/shared';
import { User } from '../models/User.js';
import { AuthToken } from '../models/AuthToken.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { AppError, validationError } from '../errors.js';
import { config } from '../config.js';
import { isMailConfigured, passwordChangedEmail, resetEmail, sendMail, verifyEmail } from './mail.js';

const sha = (v) => crypto.createHash('sha256').update(v).digest('hex');
const VERIFY_MS = 24 * 60 * 60 * 1000;
const RESET_MS = 60 * 60 * 1000;

/** Makes a one-time token, replacing any earlier one of the same kind for that person. Returns the raw token. */
async function issueToken(user, kind, ttlMs) {
  await AuthToken.deleteMany({ userId: user._id, kind });
  const raw = crypto.randomBytes(32).toString('hex');
  await AuthToken.create({ userId: user._id, kind, tokenHash: sha(raw), expiresAt: new Date(Date.now() + ttlMs) });
  return raw;
}

async function takeToken(raw, kind) {
  if (typeof raw !== 'string' || raw.length < 20) return null;
  const row = await AuthToken.findOne({ tokenHash: sha(raw), kind, usedAt: null, expiresAt: { $gt: new Date() } });
  return row;
}

async function sendVerification(user) {
  const raw = await issueToken(user, 'verify', VERIFY_MS);
  const url = `${config.appUrl}/verify-email?token=${raw}`;
  await sendMail({ to: user.email, ...verifyEmail({ name: user.name.split(' ')[0], url }) }, { link: url });
}

/** New people sign up as employees with no manager and no location; the HOD sets those. */
export async function signUp({ name, email, password }) {
  const domains = config.allowedEmailDomains;
  if (domains.length && !domains.includes(email.split('@')[1])) {
    throw validationError({ email: `Please use your work email (${domains.map((d) => `@${d}`).join(' or ')}).` });
  }
  if (await User.exists({ email })) {
    throw new AppError(
      409,
      'ACCOUNT_EXISTS',
      'There is already an account with that email.',
      'Try signing in, or use "Forgot your password?" if you do not remember it.',
      { email: 'Already registered.' },
    );
  }
  // With no way to send email (not configured), there is nothing to confirm, so the account is usable straight away.
  const needsVerification = isMailConfigured();
  const user = await User.create({
    name,
    email,
    role: 'EMPLOYEE',
    passwordHash: await bcrypt.hash(password, 10),
    emailVerified: !needsVerification,
  });
  if (needsVerification) await sendVerification(user);
  return { user, needsVerification };
}

export async function confirmEmail(raw) {
  const row = await takeToken(raw, 'verify');
  if (!row) throw new AppError(400, 'LINK_INVALID', 'This confirmation link has expired or was already used.', 'Sign in to get a new one.');
  const user = await User.findById(row.userId);
  if (!user)
    throw new AppError(400, 'LINK_INVALID', 'This confirmation link has expired or was already used.', 'Sign in to get a new one.');
  user.emailVerified = true;
  await user.save();
  row.usedAt = new Date();
  await row.save();
  return user;
}

/** Always looks the same from outside, so nobody can use it to find out who has an account. */
export async function resendVerification(email) {
  const user = await User.findOne({ email });
  if (user && !user.emailVerified) await sendVerification(user);
}

export async function requestReset(email) {
  const user = await User.findOne({ email });
  if (!user) return null;
  const raw = await issueToken(user, 'reset', RESET_MS);
  const url = `${config.appUrl}/reset-password?token=${raw}`;
  await sendMail({ to: user.email, ...resetEmail({ name: user.name.split(' ')[0], url }) }, { link: url });
  return user;
}

export async function checkResetToken(raw) {
  const row = await takeToken(raw, 'reset');
  return Boolean(row);
}

async function revokeSessions(userId) {
  await RefreshToken.updateMany({ userId, revokedAt: null }, { revokedAt: new Date() });
}

export async function resetPassword(raw, password) {
  const row = await takeToken(raw, 'reset');
  if (!row)
    throw new AppError(400, 'LINK_INVALID', 'This reset link has expired or was already used.', 'Ask for a new one from the sign-in page.');
  const user = await User.findById(row.userId);
  if (!user)
    throw new AppError(400, 'LINK_INVALID', 'This reset link has expired or was already used.', 'Ask for a new one from the sign-in page.');
  const problem = passwordProblem(password, { email: user.email, name: user.name });
  if (problem) throw validationError({ password: problem });
  user.passwordHash = await bcrypt.hash(password, 10);
  user.failedLogins = 0;
  user.lockUntil = null;
  user.emailVerified = true; // they just proved they can read this mailbox
  await user.save();
  row.usedAt = new Date();
  await row.save();
  await revokeSessions(user._id); // anyone signed in with the old password is signed out
  return user;
}

export async function changePassword(userId, currentPassword, newPassword) {
  const user = await User.findById(userId);
  if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw new AppError(
      400,
      'WRONG_PASSWORD',
      'That is not your current password.',
      'Check it and try again, or sign out and use "Forgot your password?".',
      { currentPassword: 'This does not match.' },
    );
  }
  const problem = passwordProblem(newPassword, { email: user.email, name: user.name });
  if (problem) throw validationError({ newPassword: problem });
  if (await bcrypt.compare(newPassword, user.passwordHash))
    throw validationError({ newPassword: 'Your new password is the same as the old one.' });
  user.passwordHash = await bcrypt.hash(newPassword, 10);
  await user.save();
  await revokeSessions(user._id);
  await sendMail({ to: user.email, ...passwordChangedEmail({ name: user.name.split(' ')[0] }) });
  return user;
}
