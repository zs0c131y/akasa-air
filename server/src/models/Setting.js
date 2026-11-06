import mongoose from 'mongoose';

/** Small key/value settings the HOD can change in the app (for example the default yearly allowance). */
const schema = new mongoose.Schema(
  { key: { type: String, required: true, unique: true }, value: mongoose.Schema.Types.Mixed },
  { timestamps: true },
);
export const Setting = mongoose.model('Setting', schema);
