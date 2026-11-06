import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { User } from '../models/User.js';
import { AppError } from '../errors.js';

export function signToken(user) {
  return jwt.sign({ sub: String(user._id) }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

const unauthorized = () =>
  new AppError(401, 'UNAUTHENTICATED', 'Please sign in to continue.', 'Your session may have expired.');

/** Loads the signed-in user from the Bearer token onto req.user. */
export async function requireAuth(req, _res, next) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw unauthorized();
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
  };
  next();
}
