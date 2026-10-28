import mongoose from 'mongoose';
import { schemaOptions, businessRef } from './shared.js';

const RETENTION_DAYS = 90;

// The admin bell: things the owner should know about (line getting long, invite expiring,
// SMS credits low). Different from ActivityLog, which records what happened.
const notificationSchema = new mongoose.Schema(
  {
    businessId: businessRef,
    kind: { type: String, enum: ['long_line', 'invite_expiring', 'sms_low', 'sms_used_up', 'payment_failed', 'daily_summary'], required: true },
    title: { type: String, required: true, maxlength: 120 },
    body: { type: String, required: true, maxlength: 400 },
    read: { type: Boolean, default: false },
    // Stops repeats: "line getting long" once per line per day, "credits low" once per month.
    dedupeKey: { type: String },
  },
  schemaOptions,
);

notificationSchema.index({ businessId: 1, createdAt: -1 });
notificationSchema.index({ businessId: 1, dedupeKey: 1 }, { unique: true, partialFilterExpression: { dedupeKey: { $type: 'string' } } });
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: RETENTION_DAYS * 24 * 60 * 60 });

export const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
