import mongoose from 'mongoose';

/** An in-app notice for one person: someone decided on their request, or a request is waiting for them. */
const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  kind: { type: String, required: true },
  title: { type: String, required: true },
  body: { type: String, default: '' },
  leaveId: { type: mongoose.Schema.Types.ObjectId, default: null },
  readAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  /** Notices clean themselves up 90 days after they were made. */
  expireAt: { type: Date, default: () => new Date(Date.now() + 90 * 24 * 3600 * 1000), expires: 0 },
});
schema.index({ userId: 1, readAt: 1, createdAt: -1 });

export const Notification = mongoose.model('Notification', schema);
