import mongoose from 'mongoose';

/**
 * A public holiday. Never counted as leave.
 * location null = national (applies to everyone); otherwise it applies only to people working at that location.
 * The same date can be listed once nationally and once per location.
 */
const holidaySchema = new mongoose.Schema(
  {
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    location: { type: String, default: null },
    addedBy: { type: String, default: null },
  },
  { timestamps: true },
);
holidaySchema.index({ date: 1, location: 1 }, { unique: true });

export const Holiday = mongoose.model('Holiday', holidaySchema);
