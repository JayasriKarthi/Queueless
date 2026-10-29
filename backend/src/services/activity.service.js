import { ActivityLog } from '../models/ActivityLog.js';

// Adds an entry to the business's "Recent activity" feed. Pass `session` inside a transaction.
export function logActivity({ businessId, actorId = null, kind, text, meta }, session) {
  const doc = { businessId, actorId, kind, text, meta };
  return session ? ActivityLog.create([doc], { session }) : ActivityLog.create(doc);
}

// GET /api/admin/activity: the newest entries first, for the Home page feed.
export function recentActivity(business, limit = 20) {
  return ActivityLog.find({ businessId: business._id }).sort({ createdAt: -1 }).limit(limit).select('kind text createdAt');
}
