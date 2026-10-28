import { Token } from '../models/Token.js';
import { QUEUE_MODES, TOKEN_STATUS } from '../utils/constants.js';

// Which line a token is in, and the order of each line. Ported from frontend/src/lib/queueMath.js.
//
//   shared        one line for everyone                          key "shared"
//   per_service   one line per service                           key "svc:<serviceId>"
//   per_resource  one line per doctor, counter, or stylist       key "res:<resourceId>"
//                 or "Any available" (any resource that does
//                 the token's service can call it)               key "res:any"

const PINNED = /^res:[a-f0-9]{24}$/; // a line belonging to one specific resource

export const isPinned = (queueKey) => PINNED.test(queueKey);

export function queueKeyFor(business, { serviceId, resourceId }) {
  switch (business.settings.queueMode) {
    case QUEUE_MODES.PER_SERVICE:
      return `svc:${serviceId}`;
    case QUEUE_MODES.PER_RESOURCE:
      return resourceId ? `res:${resourceId}` : 'res:any';
    default:
      return 'shared';
  }
}

// Shared lines use the business's prefix; other modes use the service's own prefix.
export const prefixFor = (business, service) =>
  business.settings.queueMode === QUEUE_MODES.SHARED ? business.settings.tokenPrefix : service.prefix;

/* ------------------------------------------------------------- order */

// Priority first, then place in line. sortAt starts as the join time; "Skip to end" moves
// it to now and clears priority. _id breaks exact ties so the order is always stable.
// Matches the Token index { businessId, status, queueKey, priority: -1, sortAt: 1 }.
export const QUEUE_ORDER = { priority: -1, sortAt: 1, _id: 1 };

export const skipToEndUpdate = () => ({ $set: { sortAt: new Date(), priority: false } });

/* ---------------------------------------------- who can call whom */

// The waiting tokens a resource may call:
//  - a token in this resource's own line, always;
//  - any token not tied to one specific resource, if the resource does its service
//    (in shared mode, every resource may call every such token).
// A token tied to another resource stays with that resource, even after the owner
// changes the queue mode, so people already waiting keep their place.
export function callableFilter(business, resource) {
  const unpinned = { queueKey: { $not: PINNED } };
  if (business.settings.queueMode !== QUEUE_MODES.SHARED) unpinned.serviceId = { $in: resource.serviceIds };
  return {
    businessId: business._id,
    status: TOKEN_STATUS.WAITING,
    $or: [{ queueKey: `res:${resource._id}` }, unpinned],
  };
}

// The same rule for one token already loaded (for "Call this one").
export function resourceCanServe(business, resource, token) {
  if (token.queueKey === `res:${resource._id}`) return true;
  if (isPinned(token.queueKey)) return false;
  if (business.settings.queueMode === QUEUE_MODES.SHARED) return true;
  return resource.serviceIds.some((id) => id.equals(token.serviceId));
}

export const waitingFor = (business, resource, { limit } = {}) => {
  const query = Token.find(callableFilter(business, resource)).sort(QUEUE_ORDER);
  return limit ? query.limit(limit) : query;
};

export const nextFor = (business, resource) => Token.findOne(callableFilter(business, resource)).sort(QUEUE_ORDER);

// The token a resource is calling or serving right now (the most recently called one).
export const currentFor = (businessId, resourceId) =>
  Token.findOne({ businessId, resourceId, status: { $in: [TOKEN_STATUS.CALLED, TOKEN_STATUS.SERVING] } }).sort({ calledAt: -1 });

// "Now serving" for a line: the resource's current token for a doctor's own line,
// otherwise the most recently called token in the same line.
export function nowServingFor(businessId, queueKey) {
  const status = { $in: [TOKEN_STATUS.CALLED, TOKEN_STATUS.SERVING] };
  const filter = isPinned(queueKey) ? { businessId, resourceId: queueKey.slice(4), status } : { businessId, queueKey, status };
  return Token.findOne(filter).sort({ calledAt: -1 }).select('code');
}

/* ----------------------------------------------------- position */

// Waiting tokens in the same line that will be called before this one, matching QUEUE_ORDER:
// higher priority, or same priority and earlier place, or same place and smaller _id.
export function aheadFilter(token) {
  const p = Boolean(token.priority);
  const samePriority = { priority: p };
  return {
    businessId: token.businessId,
    status: TOKEN_STATUS.WAITING,
    queueKey: token.queueKey,
    _id: { $ne: token._id },
    $or: [
      ...(p ? [] : [{ priority: true }]),
      { ...samePriority, sortAt: { $lt: token.sortAt } },
      { ...samePriority, sortAt: token.sortAt, _id: { $lt: token._id } },
    ],
  };
}

export const aheadOf = (token) => Token.countDocuments(aheadFilter(token));
