import mongoose from 'mongoose';

/** A person's leave allowance for one year, when it differs from the default. */
const allowanceSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    year: { type: Number, required: true },
    days: { type: Number, required: true, min: 0, max: 365 },
    setBy: { type: String, default: null },
  },
  { timestamps: true },
);
allowanceSchema.index({ userId: 1, year: 1 }, { unique: true });

export const Allowance = mongoose.model('Allowance', allowanceSchema);
