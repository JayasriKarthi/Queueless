import mongoose from 'mongoose';
import { schemaOptions, businessRef } from './shared.js';

// One line for one day. queueKey says which line: "shared", "svc:<serviceId>",
// "res:<resourceId>", or "res:any".
// The special queueKey "all" holds the business's token numbers for the day, per prefix,
// for example { A: 24, B: 7 } (see utils/tokenNumber.js). Numbers are shared by every
// line that uses the same prefix, so two doctors on prefix A never both issue A-001.
const queueSchema = new mongoose.Schema(
  {
    businessId: businessRef,
    queueKey: { type: String, required: true, match: /^(all|shared|svc:[a-f0-9]{24}|res:([a-f0-9]{24}|any))$/ },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ }, // YYYY-MM-DD in the business's time zone
    counters: { type: Map, of: Number, default: () => new Map() },
    isPaused: { type: Boolean, default: false },
  },
  schemaOptions,
);

queueSchema.index({ businessId: 1, queueKey: 1, date: 1 }, { unique: true });

export const Queue = mongoose.model('Queue', queueSchema);
export default Queue;
