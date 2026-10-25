// A small in-browser "server". Every function reads and writes the Zustand
// stores, so all open screens (and other tabs, via the storage event) update.
import { useAuthStore } from '../store/authStore';
import { useBusinessStore } from '../store/businessStore';
import { useQueueStore } from '../store/queueStore';
import { buildSeed } from '../data/seed';
import { templateFor, DEFAULT_HOURS } from '../config/templates';
import { getPlan, hasFeature, planLimit, planPrice } from '../config/plans';
import { BRAND } from '../config/theme';
import { DAY_MS, INVITE_EXPIRY_DAYS, PIN_LOCK_SECONDS, PIN_MAX_ATTEMPTS, SLUG_REDIRECT_DAYS, RESERVED_SLUGS } from '../config/constants';
import { uid, randomToken, slugify, startOfDay } from './formatters';
import { slugProblem } from './validators';
import { queueKeyFor, waitingFor, currentFor, isActive } from './queueMath';
import { createRandom, indianName, indianPhone } from './random';

const auth = () => useAuthStore.getState();
const biz = () => useBusinessStore.getState();
const queue = () => useQueueStore.getState();

const ok = (data = {}) => ({ ok: true, ...data });
const fail = (error, extra = {}) => ({ ok: false, error, ...extra });

/* ---------------------------------------------------------------- tenant */

// Admin and staff reads are always filtered by the session's businessId.
export function forTenant(items, businessId = auth().session?.businessId) {
  if (!businessId) return [];
  return items.filter((item) => item.businessId === businessId);
}

export const getBusiness = (id) => biz().businesses.find((b) => b.id === id) ?? null;

// Customers and TVs are scoped by slug only. Old slugs redirect for 90 days.
export function resolveSlug(slug) {
  const list = biz().businesses;
  const direct = list.find((b) => b.slug === slug);
  if (direct) return { business: direct };
  const now = Date.now();
  const moved = list.find((b) => b.slugHistory?.some((h) => h.slug === slug && h.redirectUntil > now));
  return moved ? { redirectTo: moved.slug } : {};
}

export function updateBusiness(id, updater) {
  biz().set((s) => ({
    businesses: s.businesses.map((b) => (b.id === id ? { ...b, ...(typeof updater === 'function' ? updater(b) : updater) } : b)),
  }));
}

export function markSetup(businessId, key, value = true) {
  updateBusiness(businessId, (b) => ({ setup: { ...b.setup, [key]: value } }));
}

export function logActivity(businessId, kind, text) {
  biz().set((s) => ({ activity: [{ id: uid('act'), businessId, at: Date.now(), kind, text }, ...s.activity].slice(0, 200) }));
}

const updateToken = (id, patch) => queue().set((s) => ({ tokens: s.tokens.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
const getToken = (id) => queue().tokens.find((t) => t.id === id);

/* ------------------------------------------------------------------ auth */

export const homeFor = (role) => (role === 'owner' ? '/admin' : '/staff');

function startSession(user) {
  auth().set((s) => ({
    session: { userId: user.id, businessId: user.businessId, role: user.role },
    users: s.users.map((u) => (u.id === user.id ? { ...u, lastLoginAt: Date.now() } : u)),
  }));
}

export function login(email, password) {
  const user = auth().users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
  if (!user || user.password !== password) return fail('Incorrect email or password.');
  if (user.status !== 'active') return fail('This account has been deactivated. Ask your business owner to restore access.');
  startSession(user);
  return ok({ user, home: homeFor(user.role) });
}

export const logout = () => auth().set({ session: null });

export const emailTaken = (email) => auth().users.some((u) => u.email.toLowerCase() === email.trim().toLowerCase());

function slugTaken(slug, exceptBusinessId) {
  const now = Date.now();
  return biz().businesses.some(
    (b) => b.id !== exceptBusinessId && (b.slug === slug || b.slugHistory?.some((h) => h.slug === slug && h.redirectUntil > now)),
  );
}

export function uniqueSlug(base, exceptBusinessId) {
  let root = slugify(base) || 'my-queue';
  if (root.length < 3) root = `${root}-queue`;
  let candidate = root;
  let n = 2;
  while (RESERVED_SLUGS.includes(candidate) || slugTaken(candidate, exceptBusinessId)) candidate = `${root}-${n++}`;
  return candidate;
}

export function signup({ name, email, password, businessName, businessType, plan }) {
  if (emailTaken(email)) return fail('An account with this email already exists. Try logging in instead.');
  const now = Date.now();
  const t = templateFor(businessType);
  const business = {
    id: uid('biz'),
    name: businessName.trim(),
    slug: uniqueSlug(businessName),
    type: businessType,
    plan: 'free',
    billingCycle: 'monthly',
    intendedPlan: plan ?? null,
    isLive: false,
    isOpen: true,
    createdAt: now,
    contact: { email, phone: '', address: '' },
    dailyCustomers: null,
    labels: t.labels,
    branding: { logoDataUrl: '', brandColor: BRAND.teal, welcomeMessage: `Welcome to ${businessName.trim()}. Join the line from your phone.`, hidePoweredBy: false },
    slugHistory: [],
    settings: t.settings,
    services: t.services,
    resources: t.resources,
    hours: DEFAULT_HOURS,
    notifications: { almostSms: false, almostBrowser: true, dailySummary: true, staffJoins: true },
    setup: { joinFormCustomised: false, brandingSet: false, hoursSet: false, qrPrinted: false, testTokenRun: false, slugConfirmed: false },
    smsUsed: 0,
  };
  const user = {
    id: uid('usr'), name: name.trim(), email: email.trim().toLowerCase(), password, role: 'owner', businessId: business.id,
    resourceId: null, pin: '1111', status: 'active', lastLoginAt: now, createdAt: now, avatarColor: BRAND.ink,
  };
  biz().set((s) => ({
    businesses: [...s.businesses, business],
    analytics: { ...s.analytics, [business.id]: { days: [], hourly: [] } },
  }));
  auth().set((s) => ({ users: [...s.users, user] }));
  startSession(user);
  logActivity(business.id, 'settings', `Business created from the ${businessType} template`);
  return ok({ business, user });
}

// Welcome step: re-seed from the chosen template (safe because the business is brand new).
export function completeWelcome(businessId, { type, dailyCustomers }) {
  const b = getBusiness(businessId);
  if (!b) return fail('Business not found');
  const patch = { dailyCustomers: dailyCustomers ?? b.dailyCustomers };
  if (type && type !== b.type && !queue().tokens.some((t) => t.businessId === businessId)) {
    const t = templateFor(type);
    Object.assign(patch, { type, labels: t.labels, settings: t.settings, services: t.services, resources: t.resources });
  }
  updateBusiness(businessId, patch);
  return ok();
}

/* ----------------------------------------------------------------- plans */

export function changePlan(businessId, planId, cycle = 'monthly') {
  const b = getBusiness(businessId);
  const plan = getPlan(planId);
  if (!b) return fail('Business not found');
  updateBusiness(businessId, { plan: plan.id, billingCycle: cycle, intendedPlan: null });
  const price = planPrice(plan, cycle);
  if (price) {
    const amount = cycle === 'yearly' ? price * 12 : price;
    biz().set((s) => ({
      invoices: [{ id: uid('inv'), businessId, number: `QL-${Math.floor(Math.random() * 90000 + 10000)}`, date: Date.now(), plan: `${plan.name} (${cycle})`, amount, status: plan.trialDays ? 'Trial' : 'Paid' }, ...s.invoices],
    }));
  }
  logActivity(businessId, 'billing', `Plan changed to ${plan.name}`);
  return ok({ plan });
}

export function computeUsage(business, { tokens, users, invites }) {
  if (!business) return null;
  const now = Date.now();
  const today = startOfDay(now);
  const used = {
    tokensPerDay: tokens.filter((t) => t.businessId === business.id && t.createdAt >= today).length,
    counters: business.resources.filter((r) => r.isActive).length,
    staffSeats:
      users.filter((u) => u.businessId === business.id && u.role !== 'owner' && u.status === 'active').length +
      invites.filter((i) => i.businessId === business.id && inviteStatus(i, now) === 'pending').length,
    smsPerMonth: business.smsUsed ?? 0,
  };
  const limits = getPlan(business.plan).limits;
  return Object.fromEntries(Object.entries(used).map(([k, v]) => [k, { used: v, limit: limits[k], over: v >= limits[k] }]));
}

const usageNow = (business) => computeUsage(business, { tokens: queue().tokens, users: auth().users, invites: auth().invites });

/* ------------------------------------------------- services and resources */

export function saveService(businessId, data, id) {
  const serviceId = id ?? uid('svc');
  updateBusiness(businessId, (b) => {
    const service = { id: serviceId, name: data.name, avgMinutes: Number(data.avgMinutes), prefix: data.prefix, isActive: data.isActive };
    const services = id ? b.services.map((s) => (s.id === id ? service : s)) : [...b.services, service];
    const resources = b.resources.map((r) => {
      const wants = data.handledBy.includes(r.id);
      const has = r.serviceIds.includes(serviceId);
      if (wants && !has) return { ...r, serviceIds: [...r.serviceIds, serviceId] };
      if (!wants && has && r.serviceIds.length > 1) return { ...r, serviceIds: r.serviceIds.filter((x) => x !== serviceId) };
      return r;
    });
    return { services, resources };
  });
  logActivity(businessId, 'settings', `${id ? 'Updated' : 'Added'} service "${data.name}"`);
  return ok({ id: serviceId });
}

export function deleteServices(businessId, ids) {
  const b = getBusiness(businessId);
  if (b.services.length - ids.length < 1) return fail('Keep at least one service so customers can join.');
  updateBusiness(businessId, (x) => ({
    services: x.services.filter((s) => !ids.includes(s.id)),
    resources: x.resources.map((r) => ({ ...r, serviceIds: r.serviceIds.filter((sid) => !ids.includes(sid)) })),
  }));
  logActivity(businessId, 'settings', `Deleted ${ids.length} service${ids.length > 1 ? 's' : ''}`);
  return ok();
}

export function setServicesActive(businessId, ids, isActive) {
  updateBusiness(businessId, (b) => ({ services: b.services.map((s) => (ids.includes(s.id) ? { ...s, isActive } : s)) }));
  return ok();
}

function counterLimitReached(business, extraActive) {
  const u = usageNow(business);
  return u.counters.used + extraActive > u.counters.limit;
}

export function saveResource(businessId, data, id) {
  const b = getBusiness(businessId);
  const existing = id ? b.resources.find((r) => r.id === id) : null;
  const becomesActive = data.isActive && !existing?.isActive;
  if (becomesActive && counterLimitReached(b, 1)) return fail('limit', { limitKey: 'counters' });
  const resourceId = id ?? uid('res');
  updateBusiness(businessId, (x) => {
    const resource = { ...(existing ?? { isPaused: false }), id: resourceId, name: data.name, serviceIds: data.serviceIds, isActive: data.isActive };
    return { resources: id ? x.resources.map((r) => (r.id === id ? resource : r)) : [...x.resources, resource] };
  });
  logActivity(businessId, 'settings', `${id ? 'Updated' : 'Added'} ${b.labels.resource.toLowerCase()} "${data.name}"`);
  return ok({ id: resourceId });
}

export function setResourcesActive(businessId, ids, isActive) {
  const b = getBusiness(businessId);
  const turningOn = b.resources.filter((r) => ids.includes(r.id) && !r.isActive).length;
  if (isActive && counterLimitReached(b, turningOn)) return fail('limit', { limitKey: 'counters' });
  updateBusiness(businessId, (x) => ({ resources: x.resources.map((r) => (ids.includes(r.id) ? { ...r, isActive } : r)) }));
  return ok();
}

export function deleteResources(businessId, ids) {
  const b = getBusiness(businessId);
  if (b.resources.length - ids.length < 1) return fail(`Keep at least one ${b.labels.resource.toLowerCase()} to serve customers.`);
  updateBusiness(businessId, (x) => ({ resources: x.resources.filter((r) => !ids.includes(r.id)) }));
  logActivity(businessId, 'settings', `Deleted ${ids.length} ${ids.length > 1 ? b.labels.resourcePlural.toLowerCase() : b.labels.resource.toLowerCase()}`);
  return ok();
}

/* ----------------------------------------------------------------- queue */

export function findActiveByPhone(businessId, phone) {
  return queue().tokens.find((t) => t.businessId === businessId && t.customer.phone === phone && isActive(t)) ?? null;
}

export function dailyLimit(business) {
  return Math.min(business.settings.maxTokensPerDay || Infinity, planLimit(business.plan, 'tokensPerDay'));
}

export function joinQueue(businessId, { serviceId, resourceId, customer, priority = false, source = 'qr' }) {
  const b = getBusiness(businessId);
  if (!b) return fail('not_found');
  if (!b.isLive) return fail('not_live');
  if (!b.isOpen) return fail('closed');
  const existing = findActiveByPhone(businessId, customer.phone);
  if (existing) return ok({ token: existing, existing: true });

  const todays = queue().tokens.filter((t) => t.businessId === businessId && t.createdAt >= startOfDay());
  if (todays.length >= dailyLimit(b)) return fail('limit');

  const mode = b.settings.queueMode;
  const resource = resourceId && resourceId !== 'any' ? b.resources.find((r) => r.id === resourceId) : null;
  const service =
    b.services.find((s) => s.id === serviceId) ??
    b.services.find((s) => resource?.serviceIds.includes(s.id)) ??
    b.services[0];
  const prefix = mode === 'shared' ? b.settings.tokenPrefix : service.prefix;
  const number = todays.filter((t) => t.code.startsWith(`${prefix}-`)).reduce((m, t) => Math.max(m, t.number), 0) + 1;
  const lineResource = mode === 'per_resource' ? resource?.id ?? null : null;

  const token = {
    id: uid('tkn'),
    businessId,
    number,
    code: `${prefix}-${String(number).padStart(3, '0')}`,
    serviceId: service.id,
    resourceId: lineResource,
    queueKey: queueKeyFor(b, { serviceId: service.id, resourceId: lineResource }),
    customer,
    priority: Boolean(priority && b.settings.allowPriority && hasFeature(b.plan, 'priorityQueues')),
    status: 'WAITING',
    source,
    createdAt: Date.now(),
    calledAt: null, servedAt: null, doneAt: null, cancelledAt: null, rating: null, recalls: 0,
  };
  queue().set((s) => ({ tokens: [...s.tokens, token] }));
  if (!b.setup?.testTokenRun) markSetup(businessId, 'testTokenRun');
  return ok({ token });
}

function finishCurrent(businessId, resourceId) {
  const current = currentFor(queue().tokens, businessId, resourceId);
  if (current) updateToken(current.id, { status: 'DONE', doneAt: Date.now(), servedAt: current.servedAt ?? Date.now() });
  return current;
}

export function callNext(businessId, resourceId) {
  const b = getBusiness(businessId);
  finishCurrent(businessId, resourceId);
  const next = waitingFor(b, queue().tokens, resourceId)[0];
  if (!next) return ok({ token: null });
  updateToken(next.id, { status: 'CALLED', resourceId, calledAt: Date.now() });
  return ok({ token: getToken(next.id) });
}

export function callSpecific(tokenId, resourceId) {
  const t = getToken(tokenId);
  finishCurrent(t.businessId, resourceId);
  updateToken(tokenId, { status: 'CALLED', resourceId, calledAt: Date.now() });
  return ok({ token: getToken(tokenId) });
}

export const startServing = (tokenId) => updateToken(tokenId, { status: 'SERVING', servedAt: Date.now() });
export const markDone = (tokenId) => updateToken(tokenId, { status: 'DONE', doneAt: Date.now() });
export const markNoShow = (tokenId) => updateToken(tokenId, { status: 'NO_SHOW', doneAt: Date.now() });
export const recall = (tokenId) => updateToken(tokenId, { calledAt: Date.now(), recalls: (getToken(tokenId)?.recalls ?? 0) + 1 });
export const skipToEnd = (tokenId) => updateToken(tokenId, { sortAt: Date.now(), priority: false });
export const removeToken = (tokenId) => updateToken(tokenId, { status: 'CANCELLED', cancelledAt: Date.now(), cancelledBy: 'staff' });
export const leaveQueue = (tokenId) => updateToken(tokenId, { status: 'CANCELLED', cancelledAt: Date.now(), cancelledBy: 'customer' });
export const rateToken = (tokenId, rating) => updateToken(tokenId, { rating });

export function setQueueOpen(businessId, isOpen) {
  updateBusiness(businessId, { isOpen });
  logActivity(businessId, 'settings', isOpen ? 'Queue reopened' : 'Queue paused (closed for now)');
}

export function setResourcePaused(businessId, resourceId, isPaused) {
  updateBusiness(businessId, (b) => ({ resources: b.resources.map((r) => (r.id === resourceId ? { ...r, isPaused } : r)) }));
}

/* --------------------------------------------------------------- invites */

export function inviteStatus(invite, now = Date.now()) {
  if (invite.status !== 'pending') return invite.status;
  return invite.expiresAt < now ? 'expired' : 'pending';
}

export function createInvite(businessId, { email, role, resourceId }) {
  const b = getBusiness(businessId);
  const clean = email.trim().toLowerCase();
  if (auth().users.some((u) => u.email.toLowerCase() === clean)) return fail('Someone with this email already has a QueueLess account.');
  if (auth().invites.some((i) => i.businessId === businessId && i.email === clean && inviteStatus(i) === 'pending')) return fail('This person already has a pending invite. Use Resend instead.');
  const u = usageNow(b);
  if (u.staffSeats.used >= u.staffSeats.limit) return fail('seat_limit', { usage: u.staffSeats });
  const now = Date.now();
  const invite = {
    id: uid('inv'), token: randomToken(), businessId, email: clean, role, resourceId, status: 'pending',
    createdAt: now, expiresAt: now + INVITE_EXPIRY_DAYS * DAY_MS, invitedBy: auth().session?.userId,
  };
  auth().set((s) => ({ invites: [invite, ...s.invites] }));
  logActivity(businessId, 'invite', `Invite sent to ${clean}`);
  return ok({ invite });
}

// A fresh token replaces the old one, so the old link stops working.
export function resendInvite(inviteId) {
  const invite = auth().invites.find((i) => i.id === inviteId);
  if (!invite) return fail('Invite not found');
  if (inviteStatus(invite) === 'expired') {
    const u = usageNow(getBusiness(invite.businessId));
    if (u.staffSeats.used >= u.staffSeats.limit) return fail('seat_limit', { usage: u.staffSeats });
  }
  const now = Date.now();
  const updated = { ...invite, token: randomToken(), status: 'pending', createdAt: now, expiresAt: now + INVITE_EXPIRY_DAYS * DAY_MS };
  auth().set((s) => ({ invites: s.invites.map((i) => (i.id === inviteId ? updated : i)) }));
  logActivity(invite.businessId, 'invite', `Invite resent to ${invite.email}`);
  return ok({ invite: updated });
}

export function revokeInvite(inviteId) {
  auth().set((s) => ({ invites: s.invites.map((i) => (i.id === inviteId ? { ...i, status: 'revoked', revokedAt: Date.now() } : i)) }));
  return ok();
}

export function getInviteByToken(token) {
  const invite = auth().invites.find((i) => i.token === token);
  if (!invite) return { valid: false };
  const business = getBusiness(invite.businessId);
  return { invite, business, valid: Boolean(business) && inviteStatus(invite) === 'pending' };
}

export function acceptInvite(token, { name, password, pin }) {
  const { invite, valid } = getInviteByToken(token);
  if (!valid) return fail('invalid');
  if (emailTaken(invite.email)) return fail('An account with this email already exists. Please log in.');
  const now = Date.now();
  const user = {
    id: uid('usr'), name: name.trim(), email: invite.email, password, role: invite.role, businessId: invite.businessId,
    resourceId: invite.resourceId, pin: pin || String(Math.floor(1000 + Math.random() * 9000)), status: 'active',
    lastLoginAt: now, createdAt: now, avatarColor: BRAND.teal,
  };
  auth().set((s) => ({
    users: [...s.users, user],
    invites: s.invites.map((i) => (i.id === invite.id ? { ...i, status: 'accepted', acceptedAt: now, userId: user.id } : i)),
  }));
  startSession(user);
  logActivity(invite.businessId, 'staff', `${user.name} accepted their invite`);
  return ok({ user });
}

/* ----------------------------------------------------------------- staff */

export function updateStaff(userId, patch) {
  const user = auth().users.find((u) => u.id === userId);
  if (patch.status === 'active' && user.status !== 'active') {
    const u = usageNow(getBusiness(user.businessId));
    if (u.staffSeats.used >= u.staffSeats.limit) return fail('seat_limit', { usage: u.staffSeats });
  }
  auth().set((s) => ({ users: s.users.map((u) => (u.id === userId ? { ...u, ...patch } : u)) }));
  return ok();
}

export function resetPin(userId) {
  const pin = String(Math.floor(1000 + Math.random() * 9000));
  updateStaff(userId, { pin });
  return ok({ pin });
}

export function switchUserWithPin(businessId, userId, pin) {
  const now = Date.now();
  const lock = auth().pinLocks[businessId] ?? { attempts: 0, lockedUntil: 0 };
  if (lock.lockedUntil > now) return fail('locked', { lockedUntil: lock.lockedUntil });
  const user = auth().users.find((u) => u.id === userId && u.businessId === businessId && u.status === 'active');
  if (!user) return fail('Staff member not found');
  const setLock = (value) => auth().set((s) => ({ pinLocks: { ...s.pinLocks, [businessId]: value } }));
  if (user.pin !== pin) {
    const attempts = lock.attempts + 1;
    if (attempts >= PIN_MAX_ATTEMPTS) {
      const lockedUntil = now + PIN_LOCK_SECONDS * 1000;
      setLock({ attempts: 0, lockedUntil });
      return fail('locked', { lockedUntil });
    }
    setLock({ attempts, lockedUntil: 0 });
    return fail('wrong_pin', { remaining: PIN_MAX_ATTEMPTS - attempts });
  }
  setLock({ attempts: 0, lockedUntil: 0 });
  startSession(user);
  return ok({ user });
}

/* ----------------------------------------------------------------- slugs */

export function checkSlugAvailability(slug, businessId) {
  const problem = slugProblem(slug);
  if (problem) return { available: false, reason: problem };
  const b = getBusiness(businessId);
  if (b?.slug === slug) return { available: true, current: true, reason: 'This is your current link' };
  if (slugTaken(slug, businessId)) return { available: false, reason: 'Already taken by another business' };
  return { available: true, reason: 'Available' };
}

export function changeSlug(businessId, newSlug) {
  const check = checkSlugAvailability(newSlug, businessId);
  if (!check.available) return fail(check.reason);
  const b = getBusiness(businessId);
  if (check.current) {
    markSetup(businessId, 'slugConfirmed');
    return ok();
  }
  const history = (b.slugHistory ?? []).filter((h) => h.slug !== newSlug);
  if (b.isLive) history.unshift({ slug: b.slug, redirectUntil: Date.now() + SLUG_REDIRECT_DAYS * DAY_MS });
  updateBusiness(businessId, { slug: newSlug, slugHistory: history, setup: { ...b.setup, slugConfirmed: true } });
  logActivity(businessId, 'settings', `Link changed from ${b.slug} to ${newSlug}`);
  return ok();
}

/* --------------------------------------------------------------- go live */

export function goLiveChecklist(b) {
  return [
    { id: 'service', label: 'Add at least one service', done: b.services.length > 0, to: '/admin/services' },
    { id: 'resource', label: `Add at least one ${b.labels.resource.toLowerCase()}`, done: b.resources.some((r) => r.isActive), to: '/admin/resources' },
    { id: 'hours', label: 'Set your opening hours', done: Object.values(b.hours).some((d) => d.open), to: '/admin/settings?tab=hours' },
    { id: 'slug', label: 'Confirm your public link', done: Boolean(b.setup?.slugConfirmed), to: '/admin/settings?tab=business' },
  ];
}

export function goLive(businessId) {
  const b = getBusiness(businessId);
  if (!goLiveChecklist(b).every((i) => i.done)) return fail('Finish the checklist first.');
  updateBusiness(businessId, { isLive: true, isOpen: true });
  logActivity(businessId, 'settings', 'Queue went live');
  return ok();
}

/* --------------------------------------------------- branding & settings */

export function updateBranding(businessId, patch) {
  updateBusiness(businessId, (b) => ({ branding: { ...b.branding, ...patch }, setup: { ...b.setup, brandingSet: true } }));
  logActivity(businessId, 'settings', 'Branding updated');
  return ok();
}

export function saveSettings(businessId, patch, setupKey) {
  updateBusiness(businessId, (b) => ({ ...patch, setup: setupKey ? { ...b.setup, [setupKey]: true } : b.setup }));
  return ok();
}

export function clearTodayQueue(businessId) {
  queue().set((s) => ({
    tokens: s.tokens.map((t) => (t.businessId === businessId && isActive(t) ? { ...t, status: 'CANCELLED', cancelledAt: Date.now(), cancelledBy: 'staff' } : t)),
  }));
  logActivity(businessId, 'settings', "Today's queue was cleared");
}

export function deleteBusiness(businessId) {
  biz().set((s) => ({ businesses: s.businesses.filter((b) => b.id !== businessId) }));
  queue().set((s) => ({ tokens: s.tokens.filter((t) => t.businessId !== businessId) }));
  auth().set((s) => ({ users: s.users.filter((u) => u.businessId !== businessId), invites: s.invites.filter((i) => i.businessId !== businessId), session: null }));
}

export function markNotificationsRead(businessId) {
  biz().set((s) => ({ notifications: s.notifications.map((n) => (n.businessId === businessId ? { ...n, read: true } : n)) }));
}

/* ----------------------------------------------------------------- reset */

export function resetDemo() {
  const seed = buildSeed();
  const session = auth().session;
  const stillExists = session && seed.users.some((u) => u.id === session.userId);
  auth().set({ users: seed.users, invites: seed.invites, pinLocks: {}, session: stillExists ? session : null });
  biz().set({ businesses: seed.businesses, invoices: seed.invoices, activity: seed.activity, notifications: seed.notifications, analytics: seed.analytics });
  queue().set({ tokens: seed.tokens });
  return ok({ loggedOut: !stillExists });
}

/* ------------------------------------------------------------ simulation */

const simRnd = createRandom(Date.now() % 100000);

function fakeCustomer(b) {
  const c = { name: indianName(simRnd), phone: indianPhone(simRnd) };
  b.settings.customerFields.forEach((f) => {
    if (c[f.key]) return;
    if (f.type === 'number') c[f.key] = simRnd.int(5, 75);
    else if (f.type === 'select' && f.options?.length) c[f.key] = simRnd.pick(f.options);
    else if (f.required) c[f.key] = f.type === 'email' ? 'guest@example.com' : 'Walk-in';
  });
  return c;
}

// Called every 20 to 40 seconds: usually a new customer joins, sometimes staff advance a line.
export function simulateTick() {
  const live = biz().businesses.filter((b) => b.isLive && b.isOpen);
  if (!live.length) return;
  const b = simRnd.pick(live);
  const resources = b.resources.filter((r) => r.isActive && !r.isPaused);
  if (!resources.length) return;
  const resource = simRnd.pick(resources);
  if (simRnd.chance(0.65)) {
    joinQueue(b.id, { serviceId: simRnd.pick(resource.serviceIds), resourceId: b.settings.queueMode === 'per_resource' ? resource.id : null, customer: fakeCustomer(b), source: 'qr' });
  } else {
    const current = currentFor(queue().tokens, b.id, resource.id);
    if (current?.status === 'CALLED') startServing(current.id);
    else callNext(b.id, resource.id);
  }
}
