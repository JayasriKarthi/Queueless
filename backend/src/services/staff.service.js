import { Resource } from '../models/Resource.js';
import { Token } from '../models/Token.js';
import { ApiError } from '../utils/ApiError.js';
import { QUEUE_MODES, TOKEN_STATUS, TOKEN_SOURCES } from '../utils/constants.js';
import { dateKey } from '../utils/tokenNumber.js';
import { scoped, assertCanUseResource, canUseAnyResource, resourceFilterFor } from './tenant.service.js';
import { callableFilter, currentFor, nextFor, waitingFor, resourceCanServe } from './queue.service.js';
import { joinQueue, transition, staffToken } from './token.service.js';
import { emitQueueEvent } from '../sockets/queue.socket.js';

const { WAITING, CALLED, SERVING, DONE, NO_SHOW } = TOKEN_STATUS;
const CLAIM_ATTEMPTS = 10;

// A resource this user may work on: in their business, active, and (for staff) their own.
async function usableResource(user, business, resourceId, { mustBeOpen = true } = {}) {
  assertCanUseResource(user, resourceId);
  const resource = await scoped(Resource, business._id).findById(resourceId);
  if (!resource) throw ApiError.notFound('NOT_FOUND', `${business.labels.resource} not found`);
  if (!resource.isActive) throw ApiError.conflict('RESOURCE_INACTIVE', `${resource.name} is switched off in Settings`);
  if (mustBeOpen && resource.isPaused) throw ApiError.conflict('RESOURCE_PAUSED', `${resource.name} is paused. Resume it to call the next person.`);
  return resource;
}

// Owners and managers may act on any token in their business. Staff may only act on tokens
// their own resource is serving, or could call from its line.
async function assertCanActOnToken(user, business, token) {
  if (canUseAnyResource(user)) return;
  if (token.resourceId) return assertCanUseResource(user, token.resourceId);
  const own = user.resourceId && (await scoped(Resource, business._id).findById(user.resourceId));
  if (!own || !resourceCanServe(business, own, token)) {
    throw ApiError.forbidden('ACCESS_DENIED', 'This customer is waiting for a different counter or doctor');
  }
}

/* ---------------------------------------------------------- calling */

// Finishes whoever this resource is serving, then claims the next person it can serve.
async function finishCurrent(business, resource) {
  const current = await currentFor(business._id, resource._id);
  if (!current) return null;
  try {
    return await transition(business, current._id, 'done');
  } catch (err) {
    if (err.code === 'INVALID_TRANSITION') return null; // someone else just finished it
    throw err;
  }
}

// POST /api/staff/resources/:id/call-next
export async function callNext(user, business, resourceId) {
  const resource = await usableResource(user, business, resourceId);
  const finished = await finishCurrent(business, resource);

  // Two staff pressing "Call next" at once both see the same first person. Only one update
  // can change that token from WAITING to CALLED; the other gets null and tries the next.
  for (let attempt = 0; attempt < CLAIM_ATTEMPTS; attempt += 1) {
    const candidate = await nextFor(business, resource);
    if (!candidate) break;
    const called = await Token.findOneAndUpdate(
      { _id: candidate._id, businessId: business._id, status: WAITING },
      { $set: { status: CALLED, resourceId: resource._id, calledAt: new Date() } },
      { returnDocument: 'after' },
    );
    if (called) {
      emitQueueEvent('token:called', business, { token: staffToken(called), resource: { id: resource.id, name: resource.name } });
      return { called, finished };
    }
  }
  return { called: null, finished };
}

// POST /api/staff/tokens/:id/call  { resourceId? }: "Call this one".
export async function callToken(user, business, tokenId, { resourceId } = {}) {
  const resource = await usableResource(user, business, resourceId ?? user.resourceId);
  const token = await scoped(Token, business._id).findById(tokenId);
  if (!token) throw ApiError.notFound('TOKEN_NOT_FOUND', 'We could not find this token');
  if (token.status === WAITING && !resourceCanServe(business, resource, token)) {
    throw ApiError.conflict('CANNOT_SERVE', `${resource.name} does not serve ${token.code}'s line`);
  }
  await finishCurrent(business, resource);
  const called = await transition(business, token._id, 'call', { resourceId: resource._id });
  emitQueueEvent('token:called', business, { token: staffToken(called), resource: { id: resource.id, name: resource.name } });
  return called;
}

// arrived, done, noShow, recall, skip, remove on one token.
export async function actOnToken(user, business, tokenId, action) {
  const token = await scoped(Token, business._id).findById(tokenId);
  if (!token) throw ApiError.notFound('TOKEN_NOT_FOUND', 'We could not find this token');
  await assertCanActOnToken(user, business, token);
  return transition(business, token._id, action, { by: 'staff' });
}

/* ---------------------------------------------------- walk-in, pause */

// POST /api/staff/walk-in. Staff add walk-ins to their own line; owners and managers anywhere.
export async function walkIn(user, business, body) {
  const request = { ...body };
  if (business.settings.queueMode === QUEUE_MODES.PER_RESOURCE && !canUseAnyResource(user)) {
    if (!user.resourceId) throw ApiError.forbidden('ACCESS_DENIED', 'You are not assigned to a counter or doctor yet');
    request.resourceId = String(user.resourceId);
  }
  return joinQueue(business, request, { source: TOKEN_SOURCES.WALK_IN });
}

// PATCH /api/staff/resources/:id/pause  { isPaused }
export async function setPaused(user, business, resourceId, isPaused) {
  const resource = await usableResource(user, business, resourceId, { mustBeOpen: false });
  resource.isPaused = isPaused;
  await resource.save();
  emitQueueEvent('resource:updated', business, { id: resource.id, isPaused });
  return resource;
}

/* ----------------------------------------------------------- console */

const WAITING_LIST_SIZE = 100;

async function todayMetrics(business, resourceId, day) {
  const base = { businessId: business._id, resourceId, day };
  const [served, noShows, waits] = await Promise.all([
    Token.countDocuments({ ...base, status: DONE }),
    Token.countDocuments({ ...base, status: NO_SHOW }),
    Token.aggregate([
      { $match: { ...base, calledAt: { $ne: null } } },
      { $group: { _id: null, avg: { $avg: { $subtract: ['$calledAt', '$createdAt'] } } } },
    ]),
  ]);
  return { served, noShows, avgWaitMinutes: waits[0] ? Math.round(waits[0].avg / 60000) : 0 };
}

// GET /api/staff/console. Everything the staff screen needs for each resource the user may use.
export async function consoleView(user, business, { resourceId } = {}) {
  const filter = { isActive: true, ...resourceFilterFor(user), ...(resourceId && { _id: resourceId }) };
  if (resourceId) assertCanUseResource(user, resourceId);
  const resources = await scoped(Resource, business._id).find(filter).sort({ createdAt: 1 });
  const day = dateKey(new Date(), business.timeZone);

  const lines = await Promise.all(
    resources.map(async (resource) => {
      const [current, waiting, waitingCount, metrics] = await Promise.all([
        currentFor(business._id, resource._id),
        waitingFor(business, resource, { limit: WAITING_LIST_SIZE }),
        Token.countDocuments(callableFilter(business, resource)),
        todayMetrics(business, resource._id, day),
      ]);
      return {
        resource: { id: resource.id, name: resource.name, isPaused: resource.isPaused, serviceIds: resource.serviceIds.map(String) },
        current: staffToken(current),
        waiting: waiting.map(staffToken),
        waitingCount,
        metrics,
      };
    }),
  );

  return {
    business: {
      id: business.id,
      name: business.name,
      slug: business.slug,
      isLive: business.isLive,
      isOpen: business.isOpen,
      labels: business.labels,
      queueMode: business.settings.queueMode,
      customerFields: business.settings.customerFields,
      noShowMinutes: business.settings.noShowMinutes,
    },
    lines,
    servingNow: lines.filter((l) => l.current && [CALLED, SERVING].includes(l.current.status)).length,
  };
}
