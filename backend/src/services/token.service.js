import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Business } from '../models/Business.js';
import { Service } from '../models/Service.js';
import { Resource } from '../models/Resource.js';
import { Token } from '../models/Token.js';
import { ApiError, ERROR_CODES } from '../utils/ApiError.js';
import { QUEUE_MODES, TOKEN_SOURCES, TOKEN_STATUS, hasFeature, planLimit } from '../utils/constants.js';
import { nextTokenNumber } from '../utils/tokenNumber.js';
import { buildCustomerSchema } from '../validators/token.validator.js';
import { queueKeyFor, prefixFor, aheadOf, skipToEndUpdate, nowServingFor } from './queue.service.js';
import { serversFor, estimateMinutes } from './eta.service.js';
import { emitQueueEvent } from '../sockets/queue.socket.js';
import { logActivity } from './activity.service.js';

const { WAITING, CALLED, SERVING, DONE, NO_SHOW, CANCELLED } = TOKEN_STATUS;

export const hashSecret = (secret) => crypto.createHash('sha256').update(secret).digest('hex');

// The smaller of the owner's own daily limit and the plan's (Free: 50 a day).
export const dailyLimit = (business) => Math.min(business.settings.maxTokensPerDay || Infinity, planLimit(business.plan, 'tokensPerDay'));

// What a customer's phone (or anyone with the token link) may see. No customer details, no secrets.
export function publicToken(token) {
  return {
    id: String(token._id),
    code: token.code,
    number: token.number,
    status: token.status,
    queueKey: token.queueKey,
    serviceId: String(token.serviceId),
    resourceId: token.resourceId ? String(token.resourceId) : null,
    priority: token.priority,
    source: token.source,
    createdAt: token.createdAt,
    calledAt: token.calledAt,
    servedAt: token.servedAt,
    doneAt: token.doneAt,
    cancelledAt: token.cancelledAt,
    rating: token.rating,
  };
}

// What staff see: the public view plus the customer's answers (name, phone, age...).
export const staffToken = (token) => token && { ...publicToken(token), customer: token.customer };

const has = (list, id) => list.some((x) => x.equals(id));

/* ------------------------------------------ which service and line */

// Picks the resource (per-resource mode only) and the service for a join, from what the
// customer chose and what is actually available right now.
async function pickTarget(business, { serviceId, resourceId }) {
  const mode = business.settings.queueMode;
  const label = business.labels.resource.toLowerCase();
  const [services, resources] = await Promise.all([
    Service.find({ businessId: business._id, isActive: true }).sort({ sortOrder: 1 }),
    Resource.find({ businessId: business._id, isActive: true }),
  ]);
  const closed = () => ApiError.conflict(ERROR_CODES.CLOSED, 'This queue is not taking customers right now');
  if (!services.length || !resources.length) throw closed();

  let resource = null;
  if (mode === QUEUE_MODES.PER_RESOURCE) {
    const wantsAny = resourceId === 'any' || (!resourceId && business.settings.allowAnyAvailable);
    if (wantsAny) {
      if (!business.settings.allowAnyAvailable) throw ApiError.badRequest('CHOOSE_RESOURCE', `Choose a ${label}`);
    } else if (resourceId) {
      resource = resources.find((r) => r._id.equals(resourceId));
      if (!resource) throw ApiError.notFound('RESOURCE_NOT_FOUND', `This ${label} is not available`);
      if (resource.isPaused) throw ApiError.conflict('RESOURCE_PAUSED', `${resource.name} is not taking customers right now. Choose another ${label}.`);
    } else if (resources.length === 1) {
      [resource] = resources;
    } else {
      throw ApiError.badRequest('CHOOSE_RESOURCE', `Choose a ${label}`);
    }
  }

  // Services someone can actually do right now: the chosen resource's, or any working resource's.
  const working = resources.filter((r) => !r.isPaused);
  const available = resource
    ? services.filter((s) => has(resource.serviceIds, s._id))
    : services.filter((s) => working.some((r) => has(r.serviceIds, s._id)));

  let service;
  if (serviceId) {
    service = available.find((s) => s._id.equals(serviceId));
    if (!service) throw ApiError.badRequest('SERVICE_NOT_AVAILABLE', 'This service is not available right now. Choose another one.');
  } else if (mode === QUEUE_MODES.PER_SERVICE && available.length > 1) {
    throw ApiError.badRequest('CHOOSE_SERVICE', `Choose a ${business.labels.service.toLowerCase()}`);
  } else {
    [service] = available;
  }
  if (!service) throw closed();
  return { service, resource };
}

/* ---------------------------------------------------------------- join */

// POST /api/public/:slug/tokens. Returns { token, existing, ahead, guestSecret? }.
export async function joinQueue(business, { serviceId, resourceId, customer: rawCustomer, priority: wantsPriority }, { source = TOKEN_SOURCES.QR } = {}) {
  // 1. Only live, open queues take customers.
  if (!business.isLive) throw ApiError.conflict(ERROR_CODES.NOT_LIVE, 'This queue is not open yet');
  if (!business.isOpen) throw ApiError.conflict(ERROR_CODES.CLOSED, 'This queue is closed right now');

  // 2. Check the customer's answers against this business's own join form.
  const parsed = buildCustomerSchema(business.settings.customerFields).safeParse(rawCustomer);
  if (!parsed.success) throw new z.ZodError(parsed.error.issues.map((issue) => ({ ...issue, path: ['customer', ...issue.path] })));
  const customer = parsed.data;

  // 3. One active token per phone: give back the one they already have.
  const existing = await Token.findOne({ businessId: business._id, activePhone: customer.phone });
  if (existing) return { token: existing, existing: true, ahead: await aheadOf(existing) };

  // 5. Which service, which line, which prefix.
  const { service, resource } = await pickTarget(business, { serviceId, resourceId });
  const queueKey = queueKeyFor(business, { serviceId: service._id, resourceId: resource?._id });
  const prefix = prefixFor(business, service);

  // 6. Priority only counts when the business offers it and the plan includes it.
  const priority = Boolean(wantsPriority && business.settings.allowPriority && hasFeature(business.plan, 'priorityQueues'));

  // 7. Number, limit, and token are saved together: if anything fails, nothing is used up.
  const guestSecret = crypto.randomBytes(24).toString('base64url');
  const limit = dailyLimit(business);
  let token;
  try {
    await mongoose.connection.transaction(async (session) => {
      const { number, code, date, total } = await nextTokenNumber({ businessId: business._id, prefix, timeZone: business.timeZone, session });
      // 4. The daily limit, counted atomically so simultaneous joins cannot slip past it.
      if (total > limit) throw ApiError.conflict(ERROR_CODES.LIMIT, "Today's line is full. Please come back tomorrow or ask at the front desk.", { limit });

      [token] = await Token.create(
        [{
          businessId: business._id, queueKey, number, code, day: date,
          serviceId: service._id, resourceId: resource?._id ?? null,
          customer, activePhone: customer.phone, priority, source,
          guestSecretHash: hashSecret(guestSecret),
        }],
        { session },
      );
      if (!business.setup?.testTokenRun) {
        await Business.updateOne({ _id: business._id }, { $set: { 'setup.testTokenRun': true } }, { session });
      }
    });
  } catch (err) {
    // Two joins for the same phone at the same instant: the database let only one through.
    if (err.code === 11000 && err.keyPattern?.activePhone) {
      const winner = await Token.findOne({ businessId: business._id, activePhone: customer.phone });
      if (winner) return { token: winner, existing: true, ahead: await aheadOf(winner) };
    }
    throw err;
  }

  emitQueueEvent('token:created', business, { token });
  // 8. The secret is shown once, here. Only its hash is stored.
  return { token, existing: false, ahead: await aheadOf(token), guestSecret };
}

/* -------------------------------------------------------------- status */

// GET /api/public/:slug/tokens/:id. Everything the customer's status page shows.
export async function tokenStatus(business, tokenId) {
  const token = mongoose.isValidObjectId(tokenId) ? await Token.findOne({ _id: tokenId, businessId: business._id }) : null;
  if (!token) throw ApiError.notFound('TOKEN_NOT_FOUND', 'We could not find this token');

  const businessId = business._id;
  const waiting = token.status === WAITING;

  const [ahead, servedBefore, nowServing, resource, service, servers] = await Promise.all([
    waiting ? aheadOf(token) : 0,
    // People in the same line today who joined earlier and are no longer waiting.
    waiting ? Token.countDocuments({ businessId, queueKey: token.queueKey, day: token.day, status: { $ne: WAITING }, createdAt: { $lt: token.createdAt } }) : 0,
    nowServingFor(businessId, token.queueKey),
    token.resourceId ? Resource.findOne({ _id: token.resourceId, businessId }).select('name') : null,
    Service.findOne({ _id: token.serviceId, businessId }).select('name avgMinutes'),
    waiting ? serversFor(business, token) : 1,
  ]);

  return {
    token: publicToken(token),
    ahead,
    waitMinutes: waiting ? estimateMinutes({ ahead, avgMinutes: service?.avgMinutes, servers }) : 0,
    progress: waiting ? Math.round(((servedBefore + 1) / (servedBefore + ahead + 1)) * 100) : 100,
    nowServing: nowServing?.code ?? null,
    resource: resource ? { id: resource.id, name: resource.name } : null,
    service: service ? { id: service.id, name: service.name } : null,
    noShowMinutes: business.settings.noShowMinutes,
  };
}

/* ---------------------------------------------- customer actions */

// The phone that joined proves it owns the token with the secret it was given.
// Compared in constant time, so response timing reveals nothing about a guess.
export function secretMatches(token, secret) {
  if (typeof secret !== 'string' || !secret) return false;
  const expected = Buffer.from(token.guestSecretHash, 'hex');
  const given = Buffer.from(hashSecret(secret), 'hex');
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

async function ownToken(business, tokenId, secret) {
  const token = await Token.findOne({ _id: tokenId, businessId: business._id });
  if (!token) throw ApiError.notFound('TOKEN_NOT_FOUND', 'We could not find this token');
  if (!secretMatches(token, secret)) throw ApiError.forbidden('INVALID_SECRET', 'Only the phone that took this token can change it');
  return token;
}

// POST /api/public/:slug/tokens/:id/leave. Waiting customers only.
export async function leaveQueue(business, tokenId, secret) {
  const token = await ownToken(business, tokenId, secret);
  return transition(business, token._id, 'leave', { by: 'customer' });
}

// POST /api/public/:slug/tokens/:id/rate. Once, after the visit is done.
export async function rateVisit(business, tokenId, secret, rating) {
  const token = await ownToken(business, tokenId, secret);
  // Matching on "done and not rated yet" in the same update makes a second rating impossible,
  // even if the customer taps twice.
  const rated = await Token.findOneAndUpdate(
    { _id: token._id, businessId: business._id, status: DONE, rating: null },
    { $set: { rating } },
    { returnDocument: 'after' },
  );
  if (!rated) {
    throw token.status !== DONE
      ? ApiError.conflict('INVALID_TRANSITION', 'You can rate your visit once it is done.', { status: token.status })
      : ApiError.conflict('ALREADY_RATED', 'Thanks, you have already rated this visit.');
  }
  await logActivity({ businessId: business._id, kind: 'rating', text: `A customer rated their visit ${rating} star${rating === 1 ? '' : 's'}` });
  return rated;
}

/* ---------------------------------------------------- status changes */

// Every allowed move. Anything else answers 409, so a double tap, two staff acting at
// once, or an out-of-date screen can never put a token into an impossible state.
const TRANSITIONS = {
  call: { from: [WAITING], verb: 'called' },
  arrived: { from: [CALLED], verb: 'marked as arrived' },
  done: { from: [CALLED, SERVING], verb: 'marked as done' },
  noShow: { from: [CALLED], verb: 'marked as a no-show' },
  recall: { from: [CALLED], verb: 'recalled' },
  skip: { from: [WAITING], verb: 'moved to the end' },
  remove: { from: [WAITING, CALLED], verb: 'removed' },
  leave: { from: [WAITING], verb: 'cancelled' },
};

const STATUS_WORDS = { WAITING: 'waiting', CALLED: 'already called', SERVING: 'being served', DONE: 'already done', NO_SHOW: 'marked as a no-show', CANCELLED: 'cancelled' };

// A finished token frees its phone, so the customer can join again later.
const finish = (fields) => [{ $set: fields }, { $unset: 'activePhone' }];

function updateFor(action, { resourceId, by } = {}) {
  const now = new Date();
  switch (action) {
    case 'call':
      return { $set: { status: CALLED, calledAt: now, resourceId } };
    case 'arrived':
      return { $set: { status: SERVING, servedAt: now } };
    case 'done':
      return finish({ status: DONE, doneAt: now, servedAt: { $ifNull: ['$servedAt', now] } });
    case 'noShow':
      return finish({ status: NO_SHOW, doneAt: now });
    case 'recall':
      return { $set: { calledAt: now }, $inc: { recalls: 1 } };
    case 'skip':
      return skipToEndUpdate();
    case 'remove':
    case 'leave':
      return finish({ status: CANCELLED, cancelledAt: now, cancelledBy: by ?? (action === 'leave' ? 'customer' : 'staff') });
    default:
      throw ApiError.internal('INTERNAL_ERROR', `Unknown token action ${action}`);
  }
}

// Applies one action atomically: the update only matches while the token is still in an
// allowed status, so of two simultaneous requests only one can succeed.
export async function transition(business, tokenId, action, options = {}) {
  const rule = TRANSITIONS[action];
  const update = updateFor(action, options);
  const token = await Token.findOneAndUpdate(
    { _id: tokenId, businessId: business._id, status: { $in: rule.from } },
    update,
    // Finishing steps are an update pipeline (to keep servedAt and remove activePhone in one go),
    // which Mongoose 9 only accepts when asked explicitly.
    { returnDocument: 'after', updatePipeline: Array.isArray(update) },
  );
  if (token) {
    emitQueueEvent('token:updated', business, { token });
    return token;
  }
  const current = await Token.findOne({ _id: tokenId, businessId: business._id }).select('status code');
  if (!current) throw ApiError.notFound('TOKEN_NOT_FOUND', 'We could not find this token');
  throw ApiError.conflict('INVALID_TRANSITION', `${current.code} is ${STATUS_WORDS[current.status]}, so it cannot be ${rule.verb}.`, {
    status: current.status,
    action,
  });
}
