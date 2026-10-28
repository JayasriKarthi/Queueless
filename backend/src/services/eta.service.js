import { Resource } from '../models/Resource.js';
import { Service } from '../models/Service.js';
import { isPinned } from './queue.service.js';

const DEFAULT_AVG_MINUTES = 5;

// How many resources work on a token's line at the same time:
//   one doctor's own line            -> 1
//   a service line or "any available" -> active, unpaused resources that do the service
//   the shared line                   -> all active, unpaused resources
export async function serversFor(business, token) {
  if (isPinned(token.queueKey)) return 1;
  const filter = { businessId: business._id, isActive: true, isPaused: false };
  if (token.queueKey !== 'shared') filter.serviceIds = token.serviceId;
  return Math.max(1, await Resource.countDocuments(filter));
}

// round((ahead + 0.5) × average minutes ÷ servers). The 0.5 accounts for the person being
// served right now being roughly half done.
export const estimateMinutes = ({ ahead, avgMinutes = DEFAULT_AVG_MINUTES, servers = 1 }) =>
  Math.round(((ahead + 0.5) * avgMinutes) / Math.max(1, servers));

// Later improvement: replace avgMinutes with a rolling average of real service times
// (doneAt - servedAt) from the last 7 days.
export async function estimateWait(business, token, ahead) {
  const [service, servers] = await Promise.all([
    Service.findOne({ _id: token.serviceId, businessId: business._id }).select('avgMinutes'),
    serversFor(business, token),
  ]);
  return estimateMinutes({ ahead, avgMinutes: service?.avgMinutes ?? DEFAULT_AVG_MINUTES, servers });
}
