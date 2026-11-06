import mongoose from 'mongoose';

/** Atomic counters, used to hand out employee IDs one after another. */
const schema = new mongoose.Schema({ _id: String, seq: { type: Number, default: 0 } });
export const Counter = mongoose.model('Counter', schema);

export async function nextSeq(name) {
  const row = await Counter.findOneAndUpdate({ _id: name }, { $inc: { seq: 1 } }, { upsert: true, new: true });
  return row.seq;
}
