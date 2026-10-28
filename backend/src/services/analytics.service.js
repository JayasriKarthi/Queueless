import { Token } from '../models/Token.js';
import { Service } from '../models/Service.js';
import { Resource } from '../models/Resource.js';
import { TOKEN_STATUS, DAY_MS, hasFeature, planForFeature } from '../utils/constants.js';
import { dateKey, DEFAULT_TIME_ZONE } from '../utils/tokenNumber.js';

// Numbers for the owner's Home and Analytics pages. Every pipeline starts with
// { businessId } so it uses the business's indexes and can never mix businesses. Days and
// hours are the business's own (its time zone), so "9 am" means 9 am at the counter.

const { DONE, NO_SHOW } = TOKEN_STATUS;
const minutes = (ms) => (ms == null ? null : Math.round(ms / 60000));
const change = (now, before) => (before ? Math.round(((now - before) / before) * 100) : null);
const zoneOf = (business) => business.timeZone || DEFAULT_TIME_ZONE;

// The last `range` local days, oldest first: ['2026-10-15', ..., '2026-10-28'].
export function lastDays(range, timeZone, now = new Date()) {
  return Array.from({ length: range }, (_, i) => dateKey(new Date(now.getTime() - (range - 1 - i) * DAY_MS), timeZone));
}

const isDone = { $eq: ['$status', DONE] };
const isNoShow = { $eq: ['$status', NO_SHOW] };
const wasCalled = { $ne: ['$calledAt', null] };
const count = (condition) => ({ $sum: { $cond: [condition, 1, 0] } });
const sumIf = (condition, value) => ({ $sum: { $cond: [condition, value, 0] } });
const waitMs = { $subtract: ['$calledAt', '$createdAt'] };

/* -------------------------------------------------------------- today */

// Tokens issued, served, no-shows, and average wait for one local day, counting only what had
// happened by `asOf` (so "yesterday" can be cut at the same time of day as now).
async function daySummary(businessId, day, asOf) {
  const [row] = await Token.aggregate([
    { $match: { businessId, day, createdAt: { $lte: asOf } } },
    {
      $group: {
        _id: null,
        issued: { $sum: 1 },
        served: count({ $and: [isDone, { $lte: ['$doneAt', asOf] }] }),
        noShows: count({ $and: [isNoShow, { $lte: ['$doneAt', asOf] }] }),
        waitMs: sumIf({ $and: [wasCalled, { $lte: ['$calledAt', asOf] }] }, waitMs),
        waited: count({ $and: [wasCalled, { $lte: ['$calledAt', asOf] }] }),
      },
    },
  ]);
  return {
    issued: row?.issued ?? 0,
    served: row?.served ?? 0,
    noShows: row?.noShows ?? 0,
    avgWaitMinutes: row?.waited ? minutes(row.waitMs / row.waited) : null,
  };
}

// Today so far, each figure with its change (in %) against yesterday at the same time.
export async function todayMetrics(business, now = new Date()) {
  const zone = zoneOf(business);
  const [today, yesterday] = await Promise.all([
    daySummary(business._id, dateKey(now, zone), now),
    daySummary(business._id, dateKey(new Date(now.getTime() - DAY_MS), zone), new Date(now.getTime() - DAY_MS)),
  ]);
  const metric = (key) => ({ value: today[key], yesterday: yesterday[key], change: today[key] == null ? null : change(today[key], yesterday[key]) });
  return { issued: metric('issued'), served: metric('served'), avgWaitMinutes: metric('avgWaitMinutes'), noShows: metric('noShows') };
}

export const summaryForDay = (business, day) => daySummary(business._id, day, new Date());

/* ------------------------------------------------------------ ranges */

// One row per local day, including days with no tokens (zeros), oldest first.
async function daily(businessId, days) {
  const rows = await Token.aggregate([
    { $match: { businessId, day: { $in: days } } },
    { $group: { _id: '$day', tokens: { $sum: 1 }, served: count(isDone), noShows: count(isNoShow), waitMs: sumIf(wasCalled, waitMs), waited: count(wasCalled) } },
  ]);
  const byDay = new Map(rows.map((r) => [r._id, r]));
  return days.map((date) => {
    const r = byDay.get(date);
    return { date, tokens: r?.tokens ?? 0, served: r?.served ?? 0, noShows: r?.noShows ?? 0, avgWaitMinutes: r?.waited ? minutes(r.waitMs / r.waited) : null };
  });
}

// Joins and average wait for each local hour of the day, over the range (busy-hours chart).
async function hourly(business, days) {
  const rows = await Token.aggregate([
    { $match: { businessId: business._id, day: { $in: days } } },
    { $group: { _id: { $hour: { date: '$createdAt', timezone: zoneOf(business) } }, customers: { $sum: 1 }, waitMs: sumIf(wasCalled, waitMs), waited: count(wasCalled) } },
  ]);
  const byHour = new Map(rows.map((r) => [r._id, r]));
  return Array.from({ length: 24 }, (_, hour) => {
    const r = byHour.get(hour);
    return {
      hour,
      customers: r?.customers ?? 0,
      perDay: r ? Math.round((r.customers / days.length) * 10) / 10 : 0,
      avgWaitMinutes: r?.waited ? minutes(r.waitMs / r.waited) : null,
    };
  });
}

// Tokens per service (the donut). Services deleted since keep their history under "Removed service".
async function serviceSplit(businessId, days) {
  const rows = await Token.aggregate([
    { $match: { businessId, day: { $in: days } } },
    { $group: { _id: '$serviceId', tokens: { $sum: 1 } } },
    { $sort: { tokens: -1 } },
  ]);
  const services = await Service.find({ businessId, _id: { $in: rows.map((r) => r._id) } }).select('name');
  const total = rows.reduce((sum, r) => sum + r.tokens, 0);
  return rows.map((r) => ({
    serviceId: String(r._id),
    name: services.find((s) => s._id.equals(r._id))?.name ?? 'Removed service',
    tokens: r.tokens,
    share: total ? Math.round((r.tokens / total) * 100) : 0,
  }));
}

// How each doctor, counter, or stylist did over the range.
async function resourcePerformance(businessId, days) {
  const rows = await Token.aggregate([
    { $match: { businessId, day: { $in: days }, resourceId: { $ne: null } } },
    {
      $group: {
        _id: '$resourceId',
        served: count(isDone),
        noShows: count(isNoShow),
        waitMs: sumIf(wasCalled, waitMs),
        waited: count(wasCalled),
        serveMs: sumIf({ $and: [isDone, { $ne: ['$servedAt', null] }] }, { $subtract: ['$doneAt', '$servedAt'] }),
        serveCount: count({ $and: [isDone, { $ne: ['$servedAt', null] }] }),
        ratingSum: sumIf({ $ne: ['$rating', null] }, '$rating'),
        ratings: count({ $ne: ['$rating', null] }),
      },
    },
  ]);
  const resources = await Resource.find({ businessId, _id: { $in: rows.map((r) => r._id) } }).select('name');
  return rows
    .map((r) => ({
      resourceId: String(r._id),
      name: resources.find((x) => x._id.equals(r._id))?.name ?? 'Removed',
      served: r.served,
      noShows: r.noShows,
      avgWaitMinutes: r.waited ? minutes(r.waitMs / r.waited) : null,
      avgServiceMinutes: r.serveCount ? minutes(r.serveMs / r.serveCount) : null,
      rating: r.ratings ? Math.round((r.ratingSum / r.ratings) * 10) / 10 : null,
      ratings: r.ratings,
    }))
    .sort((a, b) => b.served - a.served);
}

/* ------------------------------------------------------------ report */

// GET /api/admin/analytics?range=7|14|30. The advanced part needs a plan with advancedAnalytics;
// without it, `advanced` is null and `locked` names the plan that unlocks it.
export async function analyticsReport(business, range = 14, now = new Date()) {
  const days = lastDays(range, zoneOf(business), now);
  const advanced = hasFeature(business, 'advancedAnalytics');
  const [today, dailyRows, hours, services, resources] = await Promise.all([
    todayMetrics(business, now),
    daily(business._id, days),
    hourly(business, days),
    serviceSplit(business._id, days),
    advanced ? resourcePerformance(business._id, days) : null,
  ]);

  return {
    range: { days: range, from: days[0], to: days.at(-1), timeZone: zoneOf(business) },
    today,
    daily: dailyRows.map(({ date, tokens, served }) => ({ date, tokens, served })),
    customersPerHour: hours.map(({ hour, customers, perDay }) => ({ hour, customers, perDay })),
    serviceSplit: services,
    advanced: advanced
      ? {
          waitByHour: hours.map(({ hour, avgWaitMinutes }) => ({ hour, avgWaitMinutes })),
          noShowTrend: dailyRows.map(({ date, noShows, tokens }) => ({ date, noShows, rate: tokens ? Math.round((noShows / tokens) * 100) : 0 })),
          dailyWait: dailyRows.map(({ date, avgWaitMinutes }) => ({ date, avgWaitMinutes })),
          resourcePerformance: resources,
        }
      : null,
    locked: advanced ? null : { feature: 'advancedAnalytics', requiredPlan: planForFeature('advancedAnalytics').id },
  };
}
