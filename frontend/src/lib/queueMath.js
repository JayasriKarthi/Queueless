import { ACTIVE_STATUSES } from '../config/constants';

export const sortKey = (t) => t.sortAt ?? t.createdAt;
export const byQueueOrder = (a, b) => (b.priority ? 1 : 0) - (a.priority ? 1 : 0) || sortKey(a) - sortKey(b);

export const isActive = (t) => ACTIVE_STATUSES.includes(t.status);

// The key that groups tokens into one line, based on the queue mode.
export function queueKeyFor(business, { serviceId, resourceId }) {
  const mode = business.settings.queueMode;
  if (mode === 'per_service') return `svc:${serviceId}`;
  if (mode === 'per_resource') return resourceId ? `res:${resourceId}` : 'res:any';
  return 'shared';
}

// Whether a resource can call this waiting token.
export function resourceCanServe(business, resource, token) {
  const mode = business.settings.queueMode;
  if (mode === 'per_service') return resource.serviceIds.includes(token.serviceId);
  if (mode === 'per_resource') return token.queueKey === `res:${resource.id}` || (token.queueKey === 'res:any' && resource.serviceIds.includes(token.serviceId));
  return true;
}

export function waitingFor(business, tokens, resourceId) {
  const resource = business.resources.find((r) => r.id === resourceId);
  if (!resource) return [];
  return tokens.filter((t) => t.businessId === business.id && t.status === 'WAITING' && resourceCanServe(business, resource, t)).sort(byQueueOrder);
}

export const currentFor = (tokens, businessId, resourceId) =>
  tokens
    .filter((t) => t.businessId === businessId && t.resourceId === resourceId && (t.status === 'CALLED' || t.status === 'SERVING'))
    .sort((a, b) => (b.calledAt ?? 0) - (a.calledAt ?? 0))[0] ?? null;

export const waitingInBusiness = (tokens, businessId) => tokens.filter((t) => t.businessId === businessId && t.status === 'WAITING');

// Tokens in the same line that will be called before this one.
export function aheadOf(tokens, token) {
  const line = tokens.filter((t) => t.businessId === token.businessId && t.status === 'WAITING' && t.queueKey === token.queueKey).sort(byQueueOrder);
  const idx = line.findIndex((t) => t.id === token.id);
  return idx < 0 ? 0 : idx;
}

export function serversFor(business, queueKey) {
  const active = business.resources.filter((r) => r.isActive && !r.isPaused);
  if (queueKey.startsWith('res:') && queueKey !== 'res:any') return 1;
  if (queueKey.startsWith('svc:')) return Math.max(1, active.filter((r) => r.serviceIds.includes(queueKey.slice(4))).length);
  return Math.max(1, active.length);
}

export function estimateWait(business, peopleAhead, serviceId, queueKey) {
  const service = business.services.find((s) => s.id === serviceId) ?? business.services[0];
  const avg = service?.avgMinutes ?? 5;
  return Math.round(((peopleAhead + 0.5) * avg) / serversFor(business, queueKey));
}

// Rough line-level wait for the join page headline.
export function businessWait(business, tokens) {
  const waiting = waitingInBusiness(tokens, business.id).length;
  const avg = business.services.length ? business.services.reduce((s, x) => s + x.avgMinutes, 0) / business.services.length : 5;
  const servers = Math.max(1, business.resources.filter((r) => r.isActive && !r.isPaused).length);
  return { waiting, minutes: Math.round((waiting * avg) / servers) };
}

export function resourceWait(business, tokens, resource) {
  const waiting = waitingFor(business, tokens, resource.id).length;
  const svc = business.services.find((s) => resource.serviceIds.includes(s.id)) ?? business.services[0];
  return { waiting, minutes: Math.round(waiting * (svc?.avgMinutes ?? 5)) };
}
