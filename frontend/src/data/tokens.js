import { createRandom, indianName, indianPhone } from '../lib/random';
import { DAY_MS } from '../config/constants';
import { queueKeyFor } from '../lib/queueMath';

const REASONS = ['Fever or cold', 'Follow-up', 'Check-up', 'Other'];

function customerFor(business, rnd) {
  const c = { name: indianName(rnd), phone: indianPhone(rnd) };
  business.settings.customerFields.forEach((f) => {
    if (f.key === 'age') c.age = rnd.int(4, 78);
    if (f.key === 'reason') c.reason = rnd.pick(REASONS);
    if (f.key === 'account') c.account = String(rnd.int(1000, 9999));
  });
  return c;
}

// 60 to 100 tokens per live business spread over the last 30 days,
// with today's line partly served, partly waiting, so every screen has data.
export function seedTokens(businesses, now = Date.now()) {
  const tokens = [];
  businesses.filter((b) => b.isLive).forEach((business, bi) => {
    const rnd = createRandom(1000 + bi * 77);
    const counters = {};
    const make = (createdAt, status, dayKey, resource) => {
      const svcPool = business.services.filter((s) => resource.serviceIds.includes(s.id));
      const service = rnd.pick(svcPool.length ? svcPool : business.services);
      const prefix = business.settings.queueMode === 'shared' ? business.settings.tokenPrefix : service.prefix;
      const key = `${dayKey}:${prefix}`;
      counters[key] = (counters[key] ?? 0) + 1;
      const number = counters[key];
      const waitMin = rnd.int(3, 28);
      const serveMin = Math.max(2, service.avgMinutes + rnd.int(-3, 6));
      const calledAt = status === 'WAITING' ? null : createdAt + waitMin * 60000;
      const t = {
        id: `tkn_${business.slug}_${tokens.length}`,
        businessId: business.id,
        number,
        code: `${prefix}-${String(number).padStart(3, '0')}`,
        serviceId: service.id,
        resourceId: status === 'WAITING' && business.settings.queueMode !== 'per_resource' ? null : resource.id,
        customer: customerFor(business, rnd),
        priority: business.settings.allowPriority && rnd.chance(0.08),
        status,
        source: rnd.chance(0.8) ? 'qr' : 'walk-in',
        createdAt,
        calledAt,
        servedAt: ['SERVING', 'DONE'].includes(status) ? calledAt + 60000 : null,
        doneAt: status === 'DONE' ? calledAt + serveMin * 60000 : null,
        cancelledAt: status === 'CANCELLED' ? createdAt + waitMin * 30000 : null,
        rating: status === 'DONE' && rnd.chance(0.5) ? rnd.pick([3, 4, 4, 5, 5, 5]) : null,
        recalls: 0,
      };
      t.queueKey = queueKeyFor(business, { serviceId: t.serviceId, resourceId: business.settings.queueMode === 'per_resource' ? resource.id : null });
      tokens.push(t);
    };

    for (let d = 29; d >= 1; d--) {
      const dayStart = new Date(now - d * DAY_MS);
      dayStart.setHours(9, 0, 0, 0);
      const count = rnd.int(1, 3);
      for (let i = 0; i < count; i++) {
        const created = dayStart.getTime() + rnd.int(0, 9 * 60) * 60000;
        const status = rnd.chance(0.82) ? 'DONE' : rnd.chance(0.6) ? 'NO_SHOW' : 'CANCELLED';
        make(created, status, `d${d}`, rnd.pick(business.resources));
      }
    }

    // Today: served earlier, one being served per resource, then a waiting line.
    const todayStart = now - 150 * 60000;
    let minute = 0;
    const servedCount = rnd.int(6, 9);
    for (let i = 0; i < servedCount; i++) {
      minute += rnd.int(4, 10);
      make(todayStart + minute * 60000, rnd.chance(0.9) ? 'DONE' : 'NO_SHOW', 'd0', rnd.pick(business.resources));
    }
    business.resources.forEach((r, ri) => {
      minute += 3;
      make(todayStart + minute * 60000, ri === 0 ? 'SERVING' : 'CALLED', 'd0', r);
      const last = tokens[tokens.length - 1];
      last.calledAt = now - rnd.int(2, 6) * 60000;
      last.servedAt = last.status === 'SERVING' ? last.calledAt + 60000 : null;
    });
    const waitingCount = rnd.int(5, 8);
    for (let i = 0; i < waitingCount; i++) {
      minute += rnd.int(2, 5);
      make(Math.min(now - 60000, todayStart + minute * 60000), 'WAITING', 'd0', business.resources[i % business.resources.length]);
    }
  });
  return tokens;
}
