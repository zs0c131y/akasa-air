import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { AppError } from '../errors.js';
import { requireAuth, signToken } from '../middleware/auth.js';

export const authRouter = Router();

authRouter.post('/login', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!email || !password) {
    throw new AppError(400, 'VALIDATION_FAILED', 'Please enter your email and password.', '', {
      ...(email ? {} : { email: 'Email is required.' }),
      ...(password ? {} : { password: 'Password is required.' }),
    });
  }
  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new AppError(401, 'BAD_CREDENTIALS', 'That email and password do not match.', 'Check for typos, or use one of the demo accounts.');
  }
  res.json({ token: signToken(user), user: publicUser(user) });
});

authRouter.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));

function publicUser(u) {
  return { id: String(u._id), name: u.name, email: u.email, role: u.role };
}
