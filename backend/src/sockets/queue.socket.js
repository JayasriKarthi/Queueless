import { z } from 'zod';
import { Token } from '../models/Token.js';
import { Service } from '../models/Service.js';
import { resolvePublicSlug } from '../services/slug.service.js';
import { secretMatches, staffToken, tokenStatus } from '../services/token.service.js';
import { QUEUE_ORDER, nowServingFor } from '../services/queue.service.js';
import { serversFor, estimateMinutes } from '../services/eta.service.js';
import { publicBranding } from '../services/branding.service.js';
import { TOKEN_STATUS } from '../utils/constants.js';
import { emitTo, getIo } from './index.js';
import { rooms, reply, refuse, handleJoin, slugSchema, idSchema, roomLimitReached } from './rooms.js';

// Live queue events for owner and staff screens, customer phones, and join pages.
//
// Rooms joined here:
//   business:<id>  owners and staff, automatically, from their verified login (never from the client)
//   public:<id>    join pages, by slug: waiting counts and open/closed changes only
//   token:<id>     one customer's phone, with the token id and its guestSecret
export function registerQueueSocket(io, socket) {
  const { user } = socket.data;
  if (user) socket.join(rooms.business(user.businessId));

  // { slug } -> { ok, business: { id, slug, name } }
  socket.on(
    'public:join',
    handleJoin(z.object({ slug: slugSchema }), async ({ slug }, ack) => {
      if (roomLimitReached(socket)) return refuse(ack, 'TOO_MANY_ROOMS', 'Too many rooms on one connection');
      const { business } = await resolvePublicSlug(slug);
      if (!business) return refuse(ack, 'BUSINESS_NOT_FOUND', 'We could not find this business');
      socket.join(rooms.public(business._id));
      return reply(ack, { ok: true, business: { id: business.id, slug: business.slug, name: business.name } });
    }),
  );

  // { slug, tokenId, guestSecret } -> { ok, token: { id, code, status } }
  // Only the phone that took the token knows its secret, so nobody else can follow it.
  socket.on(
    'token:join',
    handleJoin(z.object({ slug: slugSchema, tokenId: idSchema, guestSecret: z.string().min(10).max(200) }), async ({ slug, tokenId, guestSecret }, ack) => {
      if (roomLimitReached(socket)) return refuse(ack, 'TOO_MANY_ROOMS', 'Too many rooms on one connection');
      const { business } = await resolvePublicSlug(slug);
      const token = business && (await Token.findOne({ _id: tokenId, businessId: business._id }).select('code status guestSecretHash'));
      if (!token) return refuse(ack, 'TOKEN_NOT_FOUND', 'We could not find this token');
      if (!secretMatches(token, guestSecret)) return refuse(ack, 'INVALID_SECRET', 'Only the phone that took this token can follow it');
      socket.join(rooms.token(token._id));
      return reply(ack, { ok: true, token: { id: token.id, code: token.code, status: token.status } });
    }),
  );
}

/* =================================================================
   Sending events. Every outgoing event is built here, per audience:
     business room   staff screens: full details, including customer names and answers
     token room      one customer's phone: their own token's status, no other customer
     public, display join pages and TVs: token codes and counts only, never names or phones
   Services call these only after the database write has succeeded.
   ================================================================= */

const { WAITING } = TOKEN_STATUS;
const unique = (list) => [...new Set(list.filter(Boolean))];

// Lines whose order or "now serving" changes when this token changes.
const affectedLines = (token) => unique([token.queueKey, token.resourceId && `res:${token.resourceId}`]);

// queue:updated to staff, TVs, and join pages: which lines changed and how many wait in each.
async function sendQueueCounts(business, changed) {
  const counts = await Token.aggregate([
    { $match: { businessId: business._id, status: WAITING } },
    { $group: { _id: '$queueKey', n: { $sum: 1 } } },
  ]);
  const lines = Object.fromEntries(counts.map((c) => [c._id, c.n]));
  const payload = { changed, waiting: counts.reduce((sum, c) => sum + c.n, 0), lines };
  for (const room of [rooms.business(business._id), rooms.display(business._id), rooms.public(business._id)]) {
    emitTo(room, 'queue:updated', payload);
  }
}

// When a line moves, everyone still waiting in it gets their new place and wait.
// One query for the whole line: position = index in call order (the same rule as aheadOf).
async function sendLinePositions(business, queueKey) {
  const waiting = await Token.find({ businessId: business._id, status: WAITING, queueKey }).sort(QUEUE_ORDER).select('code status serviceId queueKey');
  if (!waiting.length) return;

  const serviceIds = unique(waiting.map((t) => String(t.serviceId)));
  const [nowServing, services, servers] = await Promise.all([
    nowServingFor(business._id, queueKey),
    Service.find({ _id: { $in: serviceIds }, businessId: business._id }).select('avgMinutes'),
    Promise.all(serviceIds.map((serviceId) => serversFor(business, { queueKey, serviceId }))),
  ]);
  const avgBy = Object.fromEntries(services.map((s) => [s.id, s.avgMinutes]));
  const serversBy = Object.fromEntries(serviceIds.map((id, i) => [id, servers[i]]));

  waiting.forEach((token, ahead) => {
    const serviceId = String(token.serviceId);
    emitTo(rooms.token(token._id), 'token:updated', {
      token: { id: token.id, code: token.code, status: token.status },
      ahead,
      waitMinutes: estimateMinutes({ ahead, avgMinutes: avgBy[serviceId], servers: serversBy[serviceId] }),
      nowServing: nowServing?.code ?? null,
    });
  });
}

async function broadcast(event, business, { token, resource } = {}) {
  switch (event) {
    case 'token:created':
      emitTo(rooms.business(business._id), 'token:created', { token: staffToken(token) });
      await sendQueueCounts(business, [token.queueKey]);
      await sendLinePositions(business, token.queueKey); // a priority token moves others back
      break;

    case 'token:updated':
      emitTo(rooms.business(business._id), 'token:updated', { token: staffToken(token) });
      // The changed token's own phone gets its full status (called: which counter, and so on).
      if (token.status !== WAITING) emitTo(rooms.token(token._id), 'token:updated', await tokenStatus(business, token._id));
      await sendQueueCounts(business, affectedLines(token));
      for (const line of affectedLines(token)) await sendLinePositions(business, line);
      break;

    case 'token:called': {
      // The TV chime and flash, and the "It is your turn" alert. Code and counter only.
      const called = { code: token.code, resource: { id: String(resource._id), name: resource.name } };
      emitTo(rooms.display(business._id), 'token:called', called);
      emitTo(rooms.token(token._id), 'token:called', called);
      break;
    }

    case 'resource:updated': {
      const view = { id: String(resource._id), name: resource.name, isPaused: resource.isPaused, isActive: resource.isActive };
      emitTo(rooms.business(business._id), 'resource:updated', view);
      emitTo(rooms.display(business._id), 'resource:updated', view);
      await sendQueueCounts(business, [`res:${resource._id}`]); // waits change when a counter pauses
      break;
    }

    default:
      console.warn(`Unknown live event "${event}"`);
  }
}

// Called by services after a change is saved. Runs in the background: a slow or failed
// broadcast never delays or fails the request itself (clients refetch on reconnect anyway).
// Without a Socket.IO server (scripts, most tests) it does nothing at all.
export function emitQueueEvent(event, business, data) {
  if (!getIo()) return;
  broadcast(event, business, data).catch((err) => console.error(`Live update "${event}" failed`, err));
}

// Settings that public pages and TVs show: open or closed, live, name, link, branding.
export function emitBusinessUpdated(business) {
  if (!getIo()) return;
  const payload = {
    id: String(business._id),
    name: business.name,
    slug: business.slug,
    isLive: business.isLive,
    isOpen: business.isOpen,
    labels: business.labels,
    queueMode: business.settings.queueMode,
    branding: publicBranding(business),
  };
  for (const room of [rooms.business(business._id), rooms.public(business._id), rooms.display(business._id)]) {
    emitTo(room, 'business:updated', payload);
  }
}

// The admin bell (Phase 14 creates notifications and calls this).
export function emitNotification(businessId, notification) {
  emitTo(rooms.business(businessId), 'notification:new', notification);
}
