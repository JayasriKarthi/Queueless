import { ActivityLog } from '../models/ActivityLog.js';

// Adds an entry to the business's "Recent activity" feed. Pass `session` inside a transaction.
export function logActivity({ businessId, actorId = null, kind, text, meta }, session) {
  const doc = { businessId, actorId, kind, text, meta };
  return session ? ActivityLog.create([doc], { session }) : ActivityLog.create(doc);
}
