import mongoose from 'mongoose';

/** Server-side record of issued refresh tokens (only a hash is stored) so they can be rotated and revoked. */
const refreshSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true, expires: 0 }, // TTL index removes expired rows
  revokedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
});

export const RefreshToken = mongoose.model('RefreshToken', refreshSchema);
