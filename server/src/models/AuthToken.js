import mongoose from 'mongoose';

/** One-time links sent by email: confirm an address, or reset a password. Only a hash of the token is stored. */
const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  kind: { type: String, enum: ['verify', 'reset'], required: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true, expires: 0 },
  usedAt: { type: Date, default: null },
});

export const AuthToken = mongoose.model('AuthToken', schema);
