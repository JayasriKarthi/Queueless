import mongoose from 'mongoose';
import { schemaOptions, ObjectId, businessRef } from './shared.js';

const RETENTION_DAYS = 180;

// The "Recent activity" feed on the admin home page, and an audit trail.
const activityLogSchema = new mongoose.Schema(
  {
    businessId: businessRef,
    actorId: { type: ObjectId, ref: 'User', default: null }, // null for customers and the system
    kind: { type: String, enum: ['call', 'join', 'settings', 'invite', 'staff', 'billing', 'rating'], required: true },
    text: { type: String, required: true, maxlength: 300 }, // for example "Link changed from a to b"
    meta: { type: mongoose.Schema.Types.Mixed },
  },
  schemaOptions,
);

activityLogSchema.index({ businessId: 1, createdAt: -1 });
// Old entries are removed automatically after 180 days.
activityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: RETENTION_DAYS * 24 * 60 * 60 });

export const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);
export default ActivityLog;
