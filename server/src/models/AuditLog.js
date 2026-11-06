import mongoose from 'mongoose';

/**
 * Append-only record of important events. Entries can be created and read, never changed or removed:
 * update/delete operations are blocked at the model level.
 */
const auditSchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now, index: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    actorName: { type: String, default: 'Anonymous' },
    actorRole: { type: String, default: null },
    action: { type: String, required: true, index: true },
    entityType: { type: String, default: 'LeaveRequest' },
    entityId: { type: String, default: null, index: true },
    employeeName: { type: String, default: null },
    fromStatus: { type: String, default: null },
    toStatus: { type: String, default: null },
    detail: { type: String, default: null },
    ip: { type: String, default: null },
  },
  { versionKey: false },
);

const blocked = () => {
  throw new Error('Audit log entries are append-only.');
};
for (const op of [
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'findOneAndReplace',
  'replaceOne',
  'deleteOne',
  'deleteMany',
  'findOneAndDelete',
]) {
  auditSchema.pre(op, blocked);
}
auditSchema.pre('save', function () {
  if (!this.isNew) blocked();
});

export const AuditLog = mongoose.model('AuditLog', auditSchema);
