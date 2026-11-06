import mongoose from 'mongoose';

/** A work location (a base or office). Each person works from one; holidays can apply to one location or to all. */
const locationSchema = new mongoose.Schema(
  { name: { type: String, required: true, unique: true, trim: true, maxlength: 60 } },
  { timestamps: true },
);

export const Location = mongoose.model('Location', locationSchema);
