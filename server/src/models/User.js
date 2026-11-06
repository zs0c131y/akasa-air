import mongoose from 'mongoose';
import { ROLES } from '@lms/shared';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ROLES, required: true },
    /** The manager (or HOD, for managers) this user reports to. */
    managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    /** Consecutive failed sign-ins; the account locks temporarily after too many. */
    failedLogins: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
    department: { type: String, default: 'Operations' },
  },
  { timestamps: true },
);

export const User = mongoose.model('User', userSchema);
