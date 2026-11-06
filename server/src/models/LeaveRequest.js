import mongoose from 'mongoose';
import { STATUSES, ROLES } from '@lms/shared';

const documentSchema = new mongoose.Schema({
  key: { type: String, required: true },
  originalName: String,
  mimeType: String,
  size: Number,
  uploadedAt: { type: Date, default: Date.now },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
});

const timelineSchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    actorName: String,
    actorRole: { type: String, enum: ROLES },
    action: String,
    fromStatus: String,
    toStatus: String,
    comment: String,
  },
  { _id: false },
);

const leaveSchema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    employeeName: { type: String, required: true },
    /** First-level approver. Null when the requester is a manager or HOD. */
    managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    fromDate: { type: String, required: true },
    toDate: { type: String, required: true },
    days: { type: Number, required: true },
    /** Counted days of the whole stretch this request is part of (other active requests that touch it). Decides isLong. */
    chainDays: { type: Number, default: null },
    /** What was left out of the count (Sundays and public holidays), recorded when the request was made. */
    excludedSundays: { type: Number, default: 0 },
    excludedHolidays: { type: [new mongoose.Schema({ date: String, name: String }, { _id: false })], default: [] },
    isLong: { type: Boolean, required: true },
    reason: { type: String, required: true },
    /** Emergency leave over the threshold may be filed without documents (owed afterwards). */
    isEmergency: { type: Boolean, default: false },
    status: { type: String, enum: STATUSES, required: true, index: true },
    /** Which approval stage asked for more info, so the reply returns there. */
    infoRequestedFrom: { type: String, enum: ['MANAGER', 'HOD', null], default: null },
    documents: [documentSchema],
    timeline: [timelineSchema],
  },
  // optimisticConcurrency: saving a stale copy throws VersionError (no double processing)
  { timestamps: true, optimisticConcurrency: true },
);

leaveSchema.index({ employeeId: 1, fromDate: 1, toDate: 1 });

export const LeaveRequest = mongoose.model('LeaveRequest', leaveSchema);
