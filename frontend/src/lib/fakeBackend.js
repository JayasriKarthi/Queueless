// The app's server functions. Each one keeps the name and result shape the pages already use
// ({ ok, error }), and now calls the QueueLess API, then updates the stores (a cache of server
// data) so every screen re-renders. Live events from Socket.IO keep the stores current.
//
// Everything goes through the API except paid checkout (changePlan for Pro/Business), which
// switches to Stripe test mode with the billing area.
import { useAuthStore } from '../store/authStore';
import { useBusinessStore } from '../store/businessStore';
import { useQueueStore } from '../store/queueStore';
import { getPlan, planLimit } from '../config/plans';
import { startOfDay } from './formatters';
import { slugProblem } from './validators';
import { isActive } from './queueMath';
import { api, assetUrl, refreshSession, revive, setAccessToken, whenSessionLost } from './api';
import { connectSocket, disconnectSocket } from './socket';

const auth = () => useAuthStore.getState();
const biz = () => useBusinessStore.getState();
const queue = () => useQueueStore.getState();

const ok = (data = {}) => ({ ok: true, ...data });
const fail = (error, extra = {}) => ({ ok: false, error, ...extra });
// A failed API call as the pages expect it: the server's message, plus its code and field details.
const failed = (res, extra = {}) => fail(res.error, { code: res.code, details: res.details, ...extra });

/* ---------------------------------------------------------------- tenant */

// Admin and staff reads are always filtered by the session's businessId.
export function forTenant(items, businessId = auth().session?.businessId) {
  if (!businessId) return [];
  return items.filter((item) => item.businessId === businessId);
}

export const getBusiness = (id) => biz().businesses.find((b) => b.id === id) ?? null;

// Only the logged-in business (and its old links) is known here. Public pages ask the API.
export function resolveSlug(slug) {
  const list = biz().businesses;
  const direct = list.find((b) => b.slug === slug);
  if (direct) return { business: direct };
  const now = Date.now();
  const moved = list.find((b) => b.slugHistory?.some((h) => h.slug === slug && h.redirectUntil > now));
  return moved ? { redirectTo: moved.slug } : {};
}

// Changes the cached copy only (the server is updated by the calls below).
export function updateBusiness(id, updater) {
  biz().set((s) => ({
    businesses: s.businesses.map((b) => (b.id === id ? { ...b, ...(typeof updater === 'function' ? updater(b) : updater) } : b)),
  }));
}

// The server records setup progress itself (join form, hours, branding, link, first token).
// Downloading the QR code from the server marks "QR printed"; other ticks are kept on screen only.
export async function markSetup(businessId, key, value = true) {
  updateBusiness(businessId, (b) => ({ setup: { ...b.setup, [key]: value } }));
  if (key === 'qrPrinted' && value) {
    await api.get('/api/business/qr.png', { raw: true });
    await loadSession();
  }
}

/* --------------------------------------------------------------- session */

const NAME = { key: 'name', label: 'Full name', type: 'text', required: true, locked: true };
const PHONE = { key: 'phone', label: 'Mobile number', type: 'text', required: true, locked: true };

// The API's business, services, and resources, combined into the one object the pages read.
export function toBusiness({ business: b, services = [], resources = [], slugHistory = [] }) {
  return {
    ...b,
    branding: { ...b.branding, logoDataUrl: assetUrl(b.branding?.logoUrl) },
    settings: { ...b.settings, customerFields: b.settings?.customerFields?.length ? b.settings.customerFields : [NAME, PHONE] },
    services: services.map(({ id, name, avgMinutes, prefix, isActive: active }) => ({ id, name, avgMinutes, prefix, isActive: active })),
    resources: resources.map(({ id, name, serviceIds, isActive: active, isPaused }) => ({ id, name, serviceIds: serviceIds.map(String), isActive: active, isPaused })),
    slugHistory: slugHistory.map(({ slug, redirectUntil }) => ({ slug, redirectUntil })),
  };
}

export const homeFor = (role) => (role === 'owner' ? '/admin' : '/staff');

// Reloads the logged-in user and their business (with services and resources) from the API.
export async function loadSession() {
  const me = await api.get('/api/auth/me');
  if (!me.ok) return me;
  biz().set({ businesses: [toBusiness(me)] });
  auth().set({ status: 'ready', user: me.user, session: { userId: me.user.id, businessId: me.user.businessId, role: me.user.role } });
  return me;
}

function clearSession() {
  setAccessToken(null);
  // Only a logged-in connection is closed. A visitor's connection (join page, token page, TV)
  // is left alone: the "is anyone logged in?" check at start-up must not cut it off.
  if (auth().session) disconnectSocket();
  auth().set({ status: 'ready', session: null, user: null, users: [], invites: [], pinLocks: {} });
  biz().set({ businesses: [], invoices: [], activity: [], notifications: [], analytics: {} });
  queue().set({ tokens: [], lines: [], loaded: false });
}
whenSessionLost(clearSession); // the refresh cookie expired or was revoked

// App start: the refresh cookie (if any) brings the session back after a reload.
export async function restoreSession() {
  const refreshed = await refreshSession();
  if (refreshed.ok && (await loadSession()).ok) return startLive();
  clearSession();
}

// After logging in: load everything, then follow live updates.
async function begin(accessToken) {
  setAccessToken(accessToken);
  const me = await loadSession();
  if (!me.ok) {
    clearSession();
    return failed(me);
  }
  startLive();
  return ok({ user: me.user, business: getBusiness(me.user.businessId), home: homeFor(me.user.role) });
}

/* ------------------------------------------------------------ live events */

let handlersReady = false;
let reloadTimer;
const reloadSoon = () => {
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(loadSession, 300);
};

const upsertToken = (token) =>
  queue().set((s) => {
    const t = { ...revive(token), businessId: auth().session?.businessId };
    return { tokens: s.tokens.some((x) => x.id === t.id) ? s.tokens.map((x) => (x.id === t.id ? { ...x, ...t } : x)) : [...s.tokens, t] };
  });

const toNotification = (n) => ({ id: n.id, businessId: n.businessId, kind: n.kind, title: n.title, body: n.body, read: n.read, at: n.createdAt });

export async function loadNotifications() {
  const res = await api.get('/api/admin/notifications');
  if (res.ok) biz().set({ notifications: res.notifications.map(toNotification) });
  return res;
}

function startLive() {
  const socket = connectSocket();
  if (!handlersReady) {
    handlersReady = true;
    let connectedBefore = false;
    socket.on('connect', () => {
      if (connectedBefore) {
        reloadSoon(); // catch up on anything missed while offline
        reloadQueueSoon();
      }
      connectedBefore = true;
    });
    socket.on('queue:updated', reloadQueueSoon);
    socket.on('business:updated', reloadSoon);
    socket.on('resource:updated', (r) => {
      const businessId = auth().session?.businessId;
      updateBusiness(businessId, (b) => ({ resources: b.resources.map((x) => (x.id === r.id ? { ...x, isPaused: r.isPaused, isActive: r.isActive, name: r.name } : x)) }));
      reloadQueueSoon();
    });
    socket.on('token:created', ({ token }) => {
      upsertToken(token);
      reloadQueueSoon();
    });
    socket.on('token:updated', ({ token }) => {
      upsertToken(token);
      reloadQueueSoon();
    });
    socket.on('notification:new', (n) => {
      biz().set((s) => ({ notifications: [toNotification(revive(n)), ...s.notifications] }));
      if (auth().session?.role === 'owner') loadStaff(); // for example "Lakshmi accepted their invite"
    });
  }
  loadQueue();
  if (auth().session?.role === 'owner') {
    loadNotifications();
    loadStaff();
  }
}

/* ------------------------------------------------------------------ auth */

export async function login(email, password) {
  const res = await api.post('/api/auth/login', { email: email.trim(), password });
  if (!res.ok) return failed(res);
  return begin(res.accessToken);
}

// Always answers the same, whether or not the email has an account.
export async function requestPasswordReset(email) {
  const res = await api.post('/api/auth/forgot-password', { email: email.trim() });
  return res.ok ? ok({ message: res.message }) : failed(res);
}

// The link from the reset email: sets a new password and logs every session out.
export async function resetPassword(token, password) {
  const res = await api.post('/api/auth/reset-password', { token, password });
  return res.ok ? ok({ message: res.message }) : failed(res);
}

export async function logout() {
  await api.post('/api/auth/logout');
  clearSession();
}

export async function signup({ name, email, password, businessName, businessType, terms, plan }) {
  const res = await api.post('/api/auth/signup', { name, email, password, businessName, businessType, terms, ...(plan && { plan }) });
  if (!res.ok) return failed(res);
  return begin(res.accessToken);
}

// Welcome step: the server re-seeds from the chosen template while the business is brand new.
export async function completeWelcome(businessId, { type, dailyCustomers }) {
  const res = await api.post('/api/onboarding/welcome', { ...(type && { type }), dailyCustomers: dailyCustomers ?? null });
  if (!res.ok) return failed(res);
  await loadSession();
  return ok({ reseeded: res.reseeded });
}

/* ----------------------------------------------------------------- plans */

// Free (or "Skip for now"): the server sets it straight away, or, with a paid subscription,
// at the end of the period already paid for (effective: 'at_period_end').
export async function changePlan(businessId, planId) {
  if (planId !== 'free') return startCheckout(planId);
  const res = await api.post('/api/billing/plan', { plan: 'free' });
  if (!res.ok) return failed(res);
  await loadSession();
  return ok({ plan: getPlan('free'), effective: res.effective });
}

// Paid plans: the server creates a Stripe Checkout session (test mode only) and the browser goes
// to its `url`. Stripe's webhook switches the plan on; the business:updated event then reaches
// every open screen.
export async function startCheckout(planId, cycle = 'monthly') {
  const res = await api.post('/api/billing/checkout', { plan: planId, cycle });
  return res.ok ? ok({ url: res.url }) : failed(res);
}

// GET /api/billing: plan, subscription, usage meters, and invoices (amounts in rupees).
export async function getBilling() {
  const res = await api.get('/api/billing');
  return res.ok ? res : failed(res);
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
  return Object.fromEntries(Object.entries(used).map(([k, v]) => [k, { used: v, limit: planLimit(business.plan, k), over: v >= planLimit(business.plan, k) }]));
}

const usageNow = (business) => computeUsage(business, { tokens: queue().tokens, users: auth().users, invites: auth().invites });

/* ------------------------------------------------- services and resources */

// The server's "too many counters for your plan" answer, as the pages expect it.
const limitOr = (res) => (['PLAN_LIMIT', 'LIMIT'].includes(res.code) ? fail('limit', { limitKey: 'counters', message: res.error }) : failed(res));

export async function saveService(businessId, data, id) {
  const body = { name: data.name, avgMinutes: Number(data.avgMinutes), prefix: data.prefix, isActive: data.isActive, handledBy: data.handledBy ?? [] };
  const res = id ? await api.patch(`/api/admin/services/${id}`, body) : await api.post('/api/admin/services', body);
  if (!res.ok) return failed(res);
  await loadSession();
  return ok({ id: res.service.id });
}

const bulk = (kind, ids, action) => api.post(`/api/admin/${kind}/bulk`, { ids, action });

export async function deleteServices(businessId, ids) {
  const res = await bulk('services', ids, 'delete');
  if (!res.ok) return failed(res);
  await loadSession();
  return ok();
}

export async function setServicesActive(businessId, ids, isActive) {
  const res = await bulk('services', ids, isActive ? 'activate' : 'deactivate');
  if (!res.ok) return failed(res);
  await loadSession();
  return ok();
}

export async function saveResource(businessId, data, id) {
  const body = { name: data.name, serviceIds: data.serviceIds, isActive: data.isActive };
  const res = id ? await api.patch(`/api/admin/resources/${id}`, body) : await api.post('/api/admin/resources', body);
  if (!res.ok) return limitOr(res);
  await loadSession();
  return ok({ id: res.resource.id });
}

export async function setResourcesActive(businessId, ids, isActive) {
  const res = await bulk('resources', ids, isActive ? 'activate' : 'deactivate');
  if (!res.ok) return limitOr(res);
  await loadSession();
  return ok();
}

export async function deleteResources(businessId, ids) {
  const res = await bulk('resources', ids, 'delete');
  if (!res.ok) return failed(res);
  await loadSession();
  return ok();
}

/* ----------------------------------------------------------------- queue */

export function findActiveByPhone(businessId, phone) {
  return queue().tokens.find((t) => t.businessId === businessId && t.customer?.phone === phone && isActive(t)) ?? null;
}

export function dailyLimit(business) {
  return Math.min(business.settings.maxTokensPerDay || Infinity, planLimit(business.plan, 'tokensPerDay'));
}

// Customers join on the public page ({ slug }); staff add walk-ins from the console (no slug).
// Returns { ok, token, existing, guestSecret } or { ok: false, error, code }.
export async function joinQueue(businessId, { serviceId, resourceId, customer, priority = false }, { slug } = {}) {
  const body = { customer, ...(serviceId && { serviceId }), ...(resourceId && { resourceId }), ...(priority && { priority: true }) };
  const res = slug ? await api.post(`/api/public/${slug}/tokens`, body) : await api.post('/api/staff/walk-in', body);
  if (!res.ok) return failed(res);
  if (!slug) upsertToken(res.token);
  return ok({ token: res.token, existing: res.existing, ahead: res.ahead, guestSecret: res.guestSecret });
}

// The staff console's view: for each line this person may serve, who is being served now,
// who is waiting (in call order), how many wait, and today's numbers. Owners and managers get
// every line. It also fills `tokens`, which admin pages count from (waiting per service, ...).
export async function loadQueue() {
  const res = await api.get('/api/staff/console');
  if (!res.ok) return res;
  const businessId = auth().session?.businessId;
  const tokens = new Map();
  for (const line of res.lines) [line.current, ...line.waiting].filter(Boolean).forEach((t) => tokens.set(t.id, { ...t, businessId }));
  queue().set({ lines: res.lines, servingNow: res.servingNow, tokens: [...tokens.values()], loaded: true });
  return res;
}

let queueTimer;
const reloadQueueSoon = () => {
  clearTimeout(queueTimer);
  queueTimer = setTimeout(loadQueue, 200);
};

// Every action asks the server, then refreshes the lines (live events refresh other screens).
async function tokenAction(tokenId, action, body) {
  const res = await api.post(`/api/staff/tokens/${tokenId}/${action}`, body);
  if (!res.ok) return failed(res);
  await loadQueue();
  return ok({ token: res.token });
}

// Finishes whoever this resource is serving, then calls the next person in line.
export async function callNext(businessId, resourceId) {
  const res = await api.post(`/api/staff/resources/${resourceId}/call-next`);
  if (!res.ok) return failed(res);
  await loadQueue();
  return ok({ token: res.called, finished: res.finished, message: res.message });
}

export const callSpecific = (tokenId, resourceId) => tokenAction(tokenId, 'call', { resourceId });
export const startServing = (tokenId) => tokenAction(tokenId, 'arrived');
export const markDone = (tokenId) => tokenAction(tokenId, 'done');
export const markNoShow = (tokenId) => tokenAction(tokenId, 'no-show');
export const recall = (tokenId) => tokenAction(tokenId, 'recall');
export const skipToEnd = (tokenId) => tokenAction(tokenId, 'skip');
export const removeToken = (tokenId) => tokenAction(tokenId, 'remove');

export async function setResourcePaused(businessId, resourceId, isPaused) {
  const res = await api.patch(`/api/staff/resources/${resourceId}/pause`, { isPaused });
  if (!res.ok) return failed(res);
  updateBusiness(businessId, (b) => ({ resources: b.resources.map((r) => (r.id === resourceId ? { ...r, isPaused } : r)) }));
  await loadQueue();
  return ok();
}

/* --------------------------------------------------------------- invites */

export function inviteStatus(invite, now = Date.now()) {
  if (invite.status !== 'pending') return invite.status;
  return invite.expiresAt < now ? 'expired' : 'pending';
}

// The server keeps only a hash of each invite link, so a link is known only when it is created
// or resent (outside production the API returns it as devInviteLink). Remembered for this visit.
const inviteLinks = new Map(); // invite id -> token
const tokenFrom = (link) => link?.split('/').pop();

const toInvite = (row, businessId) => ({
  id: row.id,
  businessId,
  email: row.email,
  role: row.role,
  resourceId: row.resource?.id ?? row.resourceId ?? null,
  status: row.status === 'invited' ? 'pending' : row.status,
  expiresAt: row.expiresAt,
  token: inviteLinks.get(row.id) ?? null,
});

// GET /api/admin/staff: staff, managers, and invites, into the lists the pages read.
export async function loadStaff() {
  const res = await api.get('/api/admin/staff');
  if (!res.ok) return res;
  const businessId = auth().session?.businessId;
  const users = res.staff.filter((r) => r.kind === 'user').map((u) => ({
    id: u.id, businessId, name: u.name, email: u.email, role: u.role, resourceId: u.resource?.id ?? null,
    status: u.status, lastLoginAt: u.lastLoginAt, avatarColor: u.avatarColor,
  }));
  const invites = res.staff.filter((r) => r.kind === 'invite').map((i) => toInvite(i, businessId));
  auth().set({ users, invites });
  return res;
}

const seatLimit = (res) => (res.code === 'seat_limit' ? fail('seat_limit', { message: res.error }) : failed(res));

async function afterInvite(res) {
  if (!res.ok) return seatLimit(res);
  const token = tokenFrom(res.devInviteLink);
  if (token) inviteLinks.set(res.invite.id, token);
  await loadStaff();
  return ok({ invite: toInvite(res.invite, auth().session?.businessId) });
}

export async function createInvite(businessId, { email, role, resourceId }) {
  return afterInvite(await api.post('/api/admin/invites', { email: email.trim(), role, ...(resourceId && { resourceId }) }));
}

// A fresh link replaces the old one, so the old link stops working.
export async function resendInvite(inviteId) {
  return afterInvite(await api.post(`/api/admin/invites/${inviteId}/resend`));
}

export async function revokeInvite(inviteId) {
  const res = await api.post(`/api/admin/invites/${inviteId}/revoke`);
  if (!res.ok) return failed(res);
  inviteLinks.delete(inviteId);
  await loadStaff();
  return ok();
}

// The invite page: which business, which role, and the counter or doctor (no login needed).
export async function getInviteByToken(token) {
  const res = await api.get(`/api/invites/${encodeURIComponent(token)}`);
  if (!res.ok) return { valid: false, error: res.error };
  const resource = res.resource;
  return {
    valid: true,
    invite: { email: res.email, role: res.role, resourceId: resource?.id ?? null, expiresAt: res.expiresAt },
    business: {
      name: res.business.name,
      branding: { logoDataUrl: assetUrl(res.business.logoUrl), brandColor: res.business.brandColor },
      labels: { resource: resource?.label ?? 'Counter' },
      resources: resource ? [resource] : [],
    },
  };
}

// Creates the account and logs the new staff member straight in. Without a chosen PIN the
// server makes one and returns it once (generatedPin).
export async function acceptInvite(token, { name, password, confirm, pin }) {
  const res = await api.post(`/api/invites/${encodeURIComponent(token)}/accept`, { name, password, confirm, ...(pin && { pin }) });
  if (!res.ok) return failed(res);
  const started = await begin(res.accessToken);
  return started.ok ? { ...started, generatedPin: res.generatedPin } : started;
}

/* ----------------------------------------------------------------- staff */

// patch: { status: 'active' } (reactivate), { status: 'deactivated' }, or { resourceId, role }.
export async function updateStaff(userId, patch) {
  let res;
  if (patch.status === 'active') res = await api.post(`/api/admin/staff/${userId}/reactivate`);
  else if (patch.status === 'deactivated') res = await api.post(`/api/admin/staff/${userId}/deactivate`);
  else res = await api.patch(`/api/admin/staff/${userId}`, patch);
  if (!res.ok) return seatLimit(res);
  await loadStaff();
  return ok();
}

// The new PIN is in this answer only; share it with the person directly.
export async function resetPin(userId) {
  const res = await api.post(`/api/admin/staff/${userId}/reset-pin`);
  return res.ok ? ok({ pin: res.pin }) : failed(res);
}

// "Who is using this computer?": names and colours only.
export async function getTeam() {
  const res = await api.get('/api/staff/team');
  return res.ok ? ok({ team: res.team }) : failed(res);
}

// The right PIN logs the picked person in on this computer. The server counts wrong PINs
// and locks switching for a short time (code "locked", details.secondsLeft).
export async function switchUserWithPin(businessId, userId, pin) {
  const res = await api.post('/api/staff/switch-user', { userId, pin });
  if (!res.ok) return failed(res);
  return begin(res.accessToken);
}

/* ------------------------------------------------- public pages (no login) */

// GET /api/public/:slug, shaped like the business object the customer pages read.
// An old link answers with the new slug (the server redirects), so `business.slug` may differ.
export function toPublicBusiness(p) {
  return {
    ...p.business,
    branding: { logoDataUrl: assetUrl(p.branding.logoUrl), brandColor: p.branding.brandColor, welcomeMessage: p.branding.welcomeMessage, hidePoweredBy: !p.branding.showPoweredBy },
    showPoweredBy: p.branding.showPoweredBy,
    hours: p.hours.week,
    settings: { queueMode: p.business.queueMode, customerFields: p.customerFields, allowPriority: p.offers.priority, allowAnyAvailable: p.offers.anyAvailable },
    services: p.services.map((s) => ({ ...s, isActive: true })),
    resources: p.resources.map((r) => ({ ...r, isActive: true })),
    queue: p.queue,
  };
}

export async function getPublicPage(slug) {
  const res = await api.get(`/api/public/${encodeURIComponent(slug)}`);
  return res.ok ? ok({ business: toPublicBusiness(res) }) : failed(res);
}

// One customer's token: place in line, wait, progress, and who is being served.
export async function getTokenStatus(slug, tokenId) {
  const res = await api.get(`/api/public/${encodeURIComponent(slug)}/tokens/${tokenId}`);
  return res.ok ? res : failed(res);
}

// Leaving and rating need the secret this phone got when it took the token.
export async function leaveQueue(tokenId, { slug, guestSecret }) {
  const res = await api.post(`/api/public/${slug}/tokens/${tokenId}/leave`, { guestSecret });
  return res.ok ? ok({ token: res.token }) : failed(res);
}

export async function rateToken(tokenId, rating, { slug, guestSecret }) {
  const res = await api.post(`/api/public/${slug}/tokens/${tokenId}/rate`, { guestSecret, rating });
  return res.ok ? ok({ token: res.token }) : failed(res);
}

// GET /api/display/:slug: what the waiting-room TV shows (codes and counts only, no names).
// A plan without the TV display answers 402 (code PLAN_REQUIRED).
export async function getDisplay(slug) {
  const res = await api.get(`/api/display/${encodeURIComponent(slug)}`);
  if (!res.ok) return failed(res, { status: res.status });
  return ok({
    display: {
      ...res.business,
      branding: { logoDataUrl: assetUrl(res.branding.logoUrl), brandColor: res.branding.brandColor },
      resources: res.resources,
      next: res.next,
      waiting: res.waiting,
      joinPath: res.joinPath,
    },
  });
}

/* ------------------------------------------------- owner reports (live) */

// GET /api/admin/analytics?range=7|14|30: today vs yesterday, daily, hourly, services, and
// (Business plan) waits by hour, no-show trend, and per-resource performance.
export async function getAnalytics(range = 14) {
  const res = await api.get('/api/admin/analytics', { query: { range } });
  return res.ok ? ok({ report: res }) : failed(res);
}

// GET /api/admin/customers: one page of token history, filtered on the server.
export async function getCustomers({ q, status, serviceId, days = 30, page = 1, pageSize = 15 } = {}) {
  const res = await api.get('/api/admin/customers', { query: { q: q?.trim(), status, serviceId, days, page, pageSize } });
  return res.ok ? res : failed(res);
}

// The same list as a CSV file (Business plan). The browser saves it under the server's file name.
export async function downloadCustomersCsv({ q, status, serviceId, days = 30 } = {}) {
  const res = await api.get('/api/admin/customers/export.csv', { query: { q: q?.trim(), status, serviceId, days }, raw: true });
  if (!res.ok) return failed(res);
  const blob = await res.response.blob();
  const name = /filename="?([^";]+)"?/.exec(res.response.headers.get('content-disposition') ?? '')?.[1] ?? 'customers.csv';
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return ok({ name });
}

// GET /api/admin/activity: the Home page's "Recent activity".
export async function getActivity(limit = 20) {
  const res = await api.get('/api/admin/activity', { query: { limit } });
  return res.ok ? ok({ activity: res.activity.map((a) => ({ id: a.id, kind: a.kind, text: a.text, at: a.createdAt })) }) : failed(res);
}

// "Contact sales" (no login). The server refuses personal mailboxes and emails the sales inbox.
export async function sendEnterpriseLead({ name, email, company, locations, message }) {
  const res = await api.post('/api/enterprise/leads', { name, email, company, locations: Number(locations), ...(message?.trim() && { message: message.trim() }) });
  return res.ok ? ok() : failed(res);
}

/* ----------------------------------------------------------------- slugs */

export async function checkSlugAvailability(slug) {
  const problem = slugProblem(slug);
  if (problem) return { available: false, reason: problem };
  const res = await api.get('/api/business/slug/check', { query: { slug } });
  if (!res.ok) return { available: false, reason: res.error };
  return { available: res.available, current: res.current, reason: res.reason };
}

// The page asks the owner to confirm first when the business is live (printed QR codes break).
export async function changeSlug(businessId, newSlug) {
  const b = getBusiness(businessId);
  const res = await api.patch('/api/business/slug', { slug: newSlug, ...(b?.isLive && newSlug !== b.slug && { confirmBreakingQr: true }) });
  if (!res.ok) return failed(res);
  await loadSession();
  return ok();
}

/* --------------------------------------------------------------- go live */

// Worked out from the cached business, so the checklist updates as soon as anything is saved.
// The server checks the same four things again when "Go live" is pressed.
export function goLiveChecklist(b) {
  return [
    { id: 'service', label: 'Add at least one service', done: b.services.some((s) => s.isActive), to: '/admin/services' },
    { id: 'resource', label: `Add at least one ${b.labels.resource.toLowerCase()}`, done: b.resources.some((r) => r.isActive), to: '/admin/resources' },
    { id: 'hours', label: 'Set your opening hours', done: Object.values(b.hours).some((d) => d.open), to: '/admin/settings?tab=hours' },
    { id: 'slug', label: 'Confirm your public link', done: Boolean(b.setup?.slugConfirmed), to: '/admin/settings?tab=business' },
  ];
}

export async function goLive() {
  const res = await api.post('/api/business/go-live');
  if (!res.ok) return failed(res);
  await loadSession();
  return ok();
}

export async function setQueueOpen(businessId, isOpen) {
  const res = await api.patch('/api/business/open', { isOpen });
  if (!res.ok) return failed(res);
  await loadSession();
  return ok();
}

/* --------------------------------------------------- branding & settings */

// patch: { brandColor, welcomeMessage, hidePoweredBy, logoFile (a File to upload), logoDataUrl: '' to remove }
export async function updateBranding(businessId, patch) {
  const before = getBusiness(businessId)?.branding ?? {};
  const fields = Object.fromEntries(['brandColor', 'welcomeMessage', 'hidePoweredBy'].filter((k) => k in patch && patch[k] !== before[k]).map((k) => [k, patch[k]]));
  if (Object.keys(fields).length) {
    const res = await api.patch('/api/business/branding', fields);
    if (!res.ok) return failed(res);
  }
  if (patch.logoFile) {
    const form = new FormData();
    form.append('logo', patch.logoFile);
    const res = await api.post('/api/business/logo', undefined, { form });
    if (!res.ok) return failed(res);
  } else if (patch.logoDataUrl === '' && before.logoDataUrl) {
    const res = await api.del('/api/business/logo');
    if (!res.ok) return failed(res);
  }
  await loadSession();
  return ok();
}

// patch: any of name, type, contact, labels, settings, hours, notifications.
// { confirm: true } after the owner agrees to change the queue mode while people wait.
export async function saveSettings(businessId, patch, { confirm = false } = {}) {
  const allowed = ['name', 'type', 'contact', 'labels', 'settings', 'hours', 'notifications'];
  const body = Object.fromEntries(allowed.filter((k) => patch[k] !== undefined).map((k) => [k, patch[k]]));
  const res = await api.patch('/api/business/settings', { ...body, ...(confirm && { confirm: true }) });
  if (!res.ok) return failed(res);
  await loadSession();
  return ok();
}

// Danger zone: removes everyone waiting, called, or being served right now (history is kept).
export async function clearTodayQueue() {
  await loadQueue();
  const active = queue().tokens.filter(isActive);
  const results = await Promise.all(active.map((t) => api.post(`/api/staff/tokens/${t.id}/remove`)));
  await loadQueue();
  const failedCount = results.filter((r) => !r.ok).length;
  return failedCount ? fail(`${failedCount} token${failedCount === 1 ? '' : 's'} could not be removed. Try again.`) : ok({ count: active.length });
}

// Settings → Danger zone. The server needs the link typed exactly, cancels any paid plan,
// and deletes everything except invoices.
export async function deleteBusiness(businessId, slug) {
  const res = await api.del('/api/business', { slug });
  if (!res.ok) return failed(res);
  clearSession();
  return ok();
}

export async function markNotificationsRead(businessId) {
  biz().set((s) => ({ notifications: s.notifications.map((n) => (n.businessId === businessId ? { ...n, read: true } : n)) }));
  await api.post('/api/admin/notifications/read');
}
