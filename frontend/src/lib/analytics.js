import { startOfDay, trend, formatShortDate } from './formatters';
import { DAY_MS } from '../config/constants';

const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

const waitMinutes = (t) => (t.calledAt ? (t.calledAt - t.createdAt) / 60000 : null);

// Today's live numbers compared with yesterday's pre-filled history.
export function todayMetrics(tokens, history) {
  const today = startOfDay();
  const todays = tokens.filter((t) => t.createdAt >= today);
  const served = todays.filter((t) => t.status === 'DONE');
  const waits = todays.map(waitMinutes).filter((w) => w != null);
  const noShows = todays.filter((t) => t.status === 'NO_SHOW').length;
  const days = history?.days ?? [];
  const last7 = days.slice(-6);
  const y = days[days.length - 1] ?? { volume: 0, avgWait: 0, noShows: 0 };
  // Scale yesterday to the same time of day so the trend is a fair comparison.
  const dayFraction = Math.min(1, Math.max(0.15, (Date.now() - today - 8 * 3600000) / (12 * 3600000)));
  const yVolume = Math.round(y.volume * dayFraction);
  const avgWait = Math.round(avg(waits));
  return {
    tokens: { value: todays.length, change: trend(todays.length, yVolume), spark: [...last7.map((d) => d.volume), todays.length] },
    served: { value: served.length, change: trend(served.length, Math.round(yVolume * 0.85)), spark: [...last7.map((d) => Math.round(d.volume * 0.85)), served.length] },
    wait: { value: avgWait, change: trend(avgWait, y.avgWait), spark: [...last7.map((d) => d.avgWait), avgWait] },
    noShows: { value: noShows, change: trend(noShows, Math.round(y.noShows * dayFraction)), spark: [...last7.map((d) => d.noShows), noShows] },
    waiting: tokens.filter((t) => t.status === 'WAITING').length,
  };
}

export function dailySeries(tokens, history, days = 14) {
  const hist = (history?.days ?? []).slice(-(days - 1)).map((d) => ({ label: formatShortDate(d.date), volume: d.volume, noShows: d.noShows, avgWait: d.avgWait }));
  const today = startOfDay();
  const todays = tokens.filter((t) => t.createdAt >= today);
  hist.push({
    label: 'Today',
    volume: todays.length,
    noShows: todays.filter((t) => t.status === 'NO_SHOW').length,
    avgWait: Math.round(avg(todays.map(waitMinutes).filter((w) => w != null))),
  });
  return hist;
}

export function hourlySeries(history) {
  return (history?.hourly ?? []).map((h) => ({ label: `${h.hour > 12 ? h.hour - 12 : h.hour}${h.hour >= 12 ? 'pm' : 'am'}`, customers: h.customers, wait: h.wait }));
}

export function serviceSplit(business, tokens, sinceDays = 30) {
  const since = Date.now() - sinceDays * DAY_MS;
  return business.services
    .map((s) => ({ name: s.name, value: tokens.filter((t) => t.serviceId === s.id && t.createdAt >= since).length }))
    .filter((s) => s.value > 0);
}

export function resourcePerformance(business, tokens, sinceDays = 30) {
  const since = Date.now() - sinceDays * DAY_MS;
  return business.resources.map((r) => {
    const mine = tokens.filter((t) => t.resourceId === r.id && t.createdAt >= since);
    const done = mine.filter((t) => t.status === 'DONE');
    const ratings = done.map((t) => t.rating).filter(Boolean);
    return {
      id: r.id,
      name: r.name,
      served: done.length,
      noShows: mine.filter((t) => t.status === 'NO_SHOW').length,
      avgWait: Math.round(avg(mine.map(waitMinutes).filter((w) => w != null))),
      avgServe: Math.round(avg(done.filter((t) => t.servedAt && t.doneAt).map((t) => (t.doneAt - t.servedAt) / 60000))),
      rating: ratings.length ? avg(ratings).toFixed(1) : '–',
    };
  });
}
