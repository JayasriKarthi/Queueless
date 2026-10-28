import mongoose from 'mongoose';
import QRCode from 'qrcode';
import { env } from '../config/env.js';
import { Service } from '../models/Service.js';
import { Resource } from '../models/Resource.js';
import { Token } from '../models/Token.js';
import { User } from '../models/User.js';
import { StaffInvite } from '../models/StaffInvite.js';
import { ApiError } from '../utils/ApiError.js';
import { Queue } from '../models/Queue.js';
import { Business } from '../models/Business.js';
import { SlugHistory } from '../models/SlugHistory.js';
import { ActivityLog } from '../models/ActivityLog.js';
import { Notification } from '../models/Notification.js';
import { Subscription } from '../models/Subscription.js';
import { Invoice } from '../models/Invoice.js';
import { ACTIVE_STATUSES, LOCKED_FIELD_KEYS, QUEUE_MODES, TOKEN_STATUS, hasFeature } from '../utils/constants.js';
import { dateKey } from '../utils/tokenNumber.js';
import { todayHours } from '../utils/hours.js';
import { isPinned, QUEUE_ORDER } from './queue.service.js';
import { estimateMinutes } from './eta.service.js';
import { dailyLimit } from './token.service.js';
import { assertFeature } from '../middleware/planLimit.middleware.js';
import { templateFor } from '../utils/templates.js';
import { logActivity } from './activity.service.js';
import { activeHistory } from './slug.service.js';
import { publicBranding, removeLogoFile } from './branding.service.js';
import { cancelSubscriptionNow } from './billing.service.js';
import { inBackground } from './notification.service.js';
import { emitBusinessUpdated } from '../sockets/queue.socket.js';
import { disconnectUser, disconnectBusiness } from '../sockets/index.js';

const { ObjectId } = mongoose.Types;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Everything the Settings page needs in one response.
export async function businessView(business) {
  return {
    business,
    slugHistory: await activeHistory(business._id),
    effectiveBranding: publicBranding(business),
  };
}

/* ------------------------------------------------------- onboarding */

// Welcome step. If the type changed and the business has never had a customer, start again
// from the new type's template. Otherwise only the daily-customers answer is saved.
export async function completeWelcome(business, { type, dailyCustomers }, actorId) {
  const changeType = type && type !== business.type && !(await Token.exists({ businessId: business._id }));

  if (!changeType) {
    if (dailyCustomers !== undefined) business.dailyCustomers = dailyCustomers;
    await business.save();
    return { business, reseeded: false };
  }

  const template = templateFor(type);
  const businessId = business._id;
  const services = template.services.map((s, i) => ({ _id: new ObjectId(), businessId, sortOrder: i, ...s }));
  const resources = template.resources.map((r) => ({ businessId, name: r.name, serviceIds: r.services.map((i) => services[i]._id) }));

  await mongoose.connection.transaction(async (session) => {
    await Service.deleteMany({ businessId }, { session });
    await Resource.deleteMany({ businessId }, { session });
    // Old resources are gone, so nobody can stay assigned to one.
    await User.updateMany({ businessId, resourceId: { $ne: null } }, { $set: { resourceId: null } }, { session });
    await StaffInvite.updateMany({ businessId, resourceId: { $exists: true } }, { $unset: { resourceId: 1 } }, { session });
    await Service.insertMany(services, { session });
    await Resource.insertMany(resources, { session });

    business.type = type;
    business.labels = template.labels;
    business.settings = template.settings;
    if (dailyCustomers !== undefined) business.dailyCustomers = dailyCustomers;
    await business.save({ session });
    await logActivity({ businessId, actorId, kind: 'settings', text: `Business set up from the ${type} template` }, session);
  });
  return { business, reseeded: true };
}

/* ------------------------------------------------- public join page */

const DEFAULT_FIELDS = [
  { key: 'name', label: 'Full name', type: 'text', required: true, locked: true },
  { key: 'phone', label: 'Mobile number', type: 'text', required: true, locked: true },
];

// GET /api/public/:slug. Only what the join page needs: never contact details, plan details,
// staff, or anything about other customers.
export async function publicJoinPage(business) {
  const businessId = business._id;
  const [services, resources, waiting, counters] = await Promise.all([
    Service.find({ businessId, isActive: true }).sort({ sortOrder: 1, createdAt: 1 }),
    Resource.find({ businessId, isActive: true }).sort({ createdAt: 1 }),
    Token.find({ businessId, status: TOKEN_STATUS.WAITING }).select('queueKey serviceId').lean(),
    Queue.findOne({ businessId, queueKey: 'all', date: dateKey(new Date(), business.timeZone) }).select('counters'),
  ]);

  const shared = business.settings.queueMode === QUEUE_MODES.SHARED;
  const working = resources.filter((r) => !r.isPaused);
  const avgOf = (serviceIds) => {
    const own = services.filter((s) => serviceIds.some((id) => s._id.equals(id)));
    return own.length ? Math.round(own.reduce((sum, s) => sum + s.avgMinutes, 0) / own.length) : undefined;
  };

  // Wait tags. A resource's tag counts everyone it could call next (the same rule staff use).
  const resourceTags = resources.map((r) => {
    const count = waiting.filter((t) => t.queueKey === `res:${r._id}` || (!isPinned(t.queueKey) && (shared || r.serviceIds.some((id) => id.equals(t.serviceId))))).length;
    return {
      id: r.id, name: r.name, serviceIds: r.serviceIds.map(String), isPaused: r.isPaused,
      waiting: count, waitMinutes: estimateMinutes({ ahead: count, avgMinutes: avgOf(r.serviceIds), servers: 1 }),
    };
  });
  const serviceTags = services.map((s) => {
    const count = waiting.filter((t) => s._id.equals(t.serviceId)).length;
    const servers = working.filter((r) => r.serviceIds.some((id) => id.equals(s._id))).length;
    return { id: s.id, name: s.name, avgMinutes: s.avgMinutes, waiting: count, waitMinutes: estimateMinutes({ ahead: count, avgMinutes: s.avgMinutes, servers }) };
  });

  const isFull = (counters?.counters?.get('total') ?? 0) >= dailyLimit(business);
  const branding = publicBranding(business);
  const fields = business.settings.customerFields?.length ? business.settings.customerFields : DEFAULT_FIELDS;

  return {
    business: {
      id: business.id,
      name: business.name,
      slug: business.slug,
      labels: business.labels,
      queueMode: business.settings.queueMode,
      isLive: business.isLive,
      isOpen: business.isOpen,
      isFull,
      acceptingCustomers: business.isLive && business.isOpen && !isFull,
    },
    branding: { logoUrl: branding.logoUrl, brandColor: branding.brandColor, welcomeMessage: branding.welcomeMessage, showPoweredBy: !branding.hidePoweredBy },
    hours: { today: todayHours(business.hours, business.timeZone), week: business.toObject().hours },
    services: serviceTags,
    resources: resourceTags,
    customerFields: fields.map(({ key, label, type, required, options }) => ({ key, label, type, required, ...(options?.length && { options }) })),
    offers: {
      priority: Boolean(business.settings.allowPriority && hasFeature(business.plan, 'priorityQueues')),
      anyAvailable: business.settings.queueMode === QUEUE_MODES.PER_RESOURCE && Boolean(business.settings.allowAnyAvailable),
    },
    queue: {
      waiting: waiting.length,
      waitMinutes: estimateMinutes({ ahead: waiting.length, avgMinutes: avgOf(services.map((s) => s._id)), servers: working.length }),
    },
  };
}

/* ------------------------------------------------------ TV display */

const NEXT_IN_LINE = 3;

// GET /api/display/:slug. What a waiting-room TV shows: token codes and counts only, never names.
export async function displayView(business) {
  assertFeature(business, 'tvDisplay');
  const branding = publicBranding(business);
  const base = {
    business: { name: business.name, slug: business.slug, isLive: business.isLive, isOpen: business.isOpen, labels: business.labels },
    branding: { logoUrl: branding.logoUrl, brandColor: branding.brandColor },
    joinPath: `/${business.slug}`, // the TV's "Scan to join" QR code points here
  };
  if (!business.isLive) return { ...base, resources: [], next: [], waiting: 0 };

  const businessId = business._id;
  const shared = business.settings.queueMode === QUEUE_MODES.SHARED;
  const [resources, waiting, current] = await Promise.all([
    Resource.find({ businessId, isActive: true }).sort({ createdAt: 1 }),
    Token.find({ businessId, status: TOKEN_STATUS.WAITING }).sort(QUEUE_ORDER).select('code queueKey serviceId').lean(),
    Token.find({ businessId, status: { $in: [TOKEN_STATUS.CALLED, TOKEN_STATUS.SERVING] }, resourceId: { $ne: null } }).sort({ calledAt: -1 }).select('code resourceId').lean(),
  ]);

  return {
    ...base,
    resources: resources.map((r) => ({
      id: r.id,
      name: r.name,
      isPaused: r.isPaused,
      current: current.find((t) => r._id.equals(t.resourceId))?.code ?? null,
      waiting: waiting.filter((t) => t.queueKey === `res:${r._id}` || (!isPinned(t.queueKey) && (shared || r.serviceIds.some((id) => id.equals(t.serviceId))))).length,
    })),
    next: waiting.slice(0, NEXT_IN_LINE).map((t) => t.code),
    waiting: waiting.length,
  };
}

/* --------------------------------------------------------- QR code */

// The join link as a PNG QR code, for posters and emails. The frontend can also draw QR codes
// itself; downloading one here ticks "Print your QR code" in the setup guide.
export async function joinQrPng(business, size = 512) {
  const png = await QRCode.toBuffer(`${env.CLIENT_URL}/${business.slug}`, { type: 'png', width: size, margin: 2, errorCorrectionLevel: 'M' });
  if (!business.setup?.qrPrinted) {
    business.setup.qrPrinted = true;
    await business.save();
  }
  return png;
}

/* ---------------------------------------------------------- go live */

// The four things a business needs before customers can join. `fix` is where the frontend
// sends the owner to complete each one.
export async function goLiveChecklist(business) {
  const [hasService, hasResource] = await Promise.all([
    Service.exists({ businessId: business._id, isActive: true }),
    Resource.exists({ businessId: business._id, isActive: true }),
  ]);
  const items = [
    { id: 'service', label: 'Add at least one service', done: Boolean(hasService), fix: '/admin/services' },
    { id: 'resource', label: `Add at least one ${business.labels.resource.toLowerCase()}`, done: Boolean(hasResource), fix: '/admin/resources' },
    { id: 'hours', label: 'Set your opening hours', done: Object.values(business.toObject().hours ?? {}).some((day) => day?.open), fix: '/admin/settings?tab=hours' },
    { id: 'slug', label: 'Confirm your public link', done: Boolean(business.setup?.slugConfirmed), fix: '/admin/settings?tab=business' },
  ];
  return { items, ready: items.every((item) => item.done), isLive: business.isLive };
}

// POST /api/business/go-live: opens the queue to customers once every item is done.
export async function goLive(business, actorId) {
  if (business.isLive) return business;
  const checklist = await goLiveChecklist(business);
  if (!checklist.ready) {
    const missing = checklist.items.filter((item) => !item.done);
    throw ApiError.conflict('NOT_READY', `Finish the checklist first: ${missing.map((m) => m.label.toLowerCase()).join(', ')}.`, { items: checklist.items });
  }
  business.isLive = true;
  business.isOpen = true;
  await business.save();
  await logActivity({ businessId: business._id, actorId, kind: 'settings', text: 'Queue went live' });
  emitBusinessUpdated(business);
  return business;
}

// PATCH /api/business/open: "Pause queue (close for now)". People already waiting are still served.
export async function setOpen(business, isOpen, actorId) {
  if (business.isOpen !== isOpen) {
    business.isOpen = isOpen;
    await business.save();
    await logActivity({ businessId: business._id, actorId, kind: 'settings', text: isOpen ? 'Queue reopened' : 'Queue paused (closed for now)' });
    emitBusinessUpdated(business);
  }
  return business;
}

/* --------------------------------------------------------- settings */

// Name and phone always stay text fields, required, and locked.
const normaliseFields = (fields) =>
  fields.map((f) => (LOCKED_FIELD_KEYS.includes(f.key) ? { ...f, type: 'text', required: true, locked: true } : { ...f, locked: false }));

// Saves any mix of the Settings tabs. Plans never block saving a setting.
export async function updateSettings(business, body, actorId) {
  const { confirm, ...changes } = body;
  const before = business.toObject();

  // Changing how lines work while people are waiting needs the owner's confirmation.
  const newMode = changes.settings?.queueMode;
  if (newMode && newMode !== business.settings.queueMode && !confirm) {
    const count = await Token.countDocuments({ businessId: business._id, status: { $in: ACTIVE_STATUSES } });
    if (count > 0) {
      throw ApiError.conflict(
        'ACTIVE_TOKENS',
        `${count} ${count === 1 ? 'person is' : 'people are'} in line right now. They keep their place, but new customers will join the new way. Send confirm: true to continue.`,
        { count },
      );
    }
  }

  if (changes.name !== undefined) business.name = changes.name;
  if (changes.type !== undefined) business.type = changes.type;
  if (changes.hours !== undefined) business.hours = changes.hours;
  // Partial updates: only the keys sent are changed inside these groups.
  for (const group of ['contact', 'labels', 'notifications']) {
    if (changes[group]) business.set(group, { ...before[group], ...changes[group] });
  }
  if (changes.settings) {
    const { customerFields, ...rest } = changes.settings;
    business.set('settings', { ...before.settings, ...rest, ...(customerFields && { customerFields: normaliseFields(customerFields) }) });
  }

  // Setup guide progress, as the frontend tracks it.
  if (changes.settings?.customerFields && !same(business.settings.customerFields, before.settings.customerFields)) business.setup.joinFormCustomised = true;
  if (changes.hours && !same(business.toObject().hours, before.hours)) business.setup.hoursSet = true;

  await business.save();
  emitBusinessUpdated(business);
  const changed = Object.keys(changes).join(', ');
  await logActivity({ businessId: business._id, actorId, kind: 'settings', text: `Settings updated: ${changed}` });
  return business;
}

/* ------------------------------------------------------ danger zone */

// Everything else one business owns. The Business and its users are removed first.
// Invoices are not in this list: they are kept for tax records.
const BUSINESS_DATA = [Token, Queue, Service, Resource, StaffInvite, SlugHistory, ActivityLog, Notification, Subscription];

// DELETE /api/business. The owner types the business's link to confirm. In order:
// 1. the paid plan is cancelled at Stripe (if that fails, nothing is deleted);
// 2. the business and every account in it are removed, so logins, staff screens, and the
//    public page stop at once, and the link and emails are free to use again;
// 3. the rest (tokens can number in the thousands) is deleted in the background.
// Invoices stay, with the business's name and contact copied onto them first.
export async function deleteBusiness(business, { slug }) {
  if (slug.trim().toLowerCase() !== business.slug) {
    throw ApiError.badRequest('SLUG_MISMATCH', `Type ${business.slug} exactly to confirm.`);
  }
  await cancelSubscriptionNow(business);

  const { name, contact } = business;
  await Invoice.updateMany({ businessId: business._id }, { $set: { billedTo: { name, email: contact?.email || null, address: contact?.address || null } } });

  const users = await User.find({ businessId: business._id }).select('_id');
  await User.deleteMany({ businessId: business._id });
  await Business.deleteOne({ _id: business._id });
  users.forEach((user) => disconnectUser(user._id));
  disconnectBusiness(business._id);
  // Its own activity log is deleted with it, so the record of the deletion is the server log.
  console.info(`[account] Business ${business._id} (${business.slug}) was deleted by its owner`);

  inBackground(async () => {
    await Promise.all(BUSINESS_DATA.map((Model) => Model.deleteMany({ businessId: business._id })));
    await removeLogoFile(business.branding.logoUrl);
  });
}
