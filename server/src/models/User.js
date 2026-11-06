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
    /** Work location (a Location name). Decides which local holidays apply to this person. Null = national holidays only. */
    location: { type: String, default: null },
    /** False for a new sign-up until they click the link in the email. Demo and invited accounts are verified. */
    emailVerified: { type: Boolean, default: true },
    /** Staff-style ID such as AKA-0007, handed out in order. */
    employeeCode: { type: String, unique: true, sparse: true },
    /** Whether decisions are also emailed to this person (in-app notices are always on). */
    emailNotifications: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// Every new person gets the next employee ID.
userSchema.pre('validate', async function assignCode() {
  if (!this.employeeCode) {
    const { nextSeq } = await import('./Counter.js');
    this.employeeCode = `AKA-${String(await nextSeq('employee')).padStart(4, '0')}`;
  }
});

export const User = mongoose.model('User', userSchema);

/** Gives an ID to people created before IDs existed, oldest first. Safe to run on every start. */
export async function backfillEmployeeCodes() {
  const missing = await User.find({ employeeCode: { $exists: false } }).sort({ createdAt: 1 });
  for (const u of missing) await u.save();
  return missing.length;
}
