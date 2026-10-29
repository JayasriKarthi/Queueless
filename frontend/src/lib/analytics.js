import { formatShortDate } from './formatters';

// Shapes the server's analytics report (GET /api/admin/analytics) for the charts and tiles.
// The numbers themselves are all worked out on the server, in the business's time zone.

export const hourLabel = (h) => `${h % 12 === 0 ? 12 : h % 12}${h >= 12 ? 'pm' : 'am'}`;
const lastWeek = (list) => list.slice(-7);

// Today's tiles: each value with its change (in %) against yesterday at the same time of day,
// and a 7-day sparkline.
export function todayTiles(report) {
  const { today, daily, advanced } = report;
  return {
    tokens: { value: today.issued.value, change: today.issued.change, spark: lastWeek(daily.map((d) => d.tokens)) },
    served: { value: today.served.value, change: today.served.change, spark: lastWeek(daily.map((d) => d.served)) },
    wait: { value: today.avgWaitMinutes.value ?? 0, change: today.avgWaitMinutes.change, spark: advanced ? lastWeek(advanced.dailyWait.map((d) => d.avgWaitMinutes ?? 0)) : undefined },
    noShows: { value: today.noShows.value, change: today.noShows.change, spark: advanced ? lastWeek(advanced.noShowTrend.map((d) => d.noShows)) : undefined },
  };
}

// One point per day, oldest first; the last one is today.
export function dailyChart(report) {
  return report.daily.map((d, i, all) => ({
    label: i === all.length - 1 ? 'Today' : formatShortDate(`${d.date}T00:00:00`),
    volume: d.tokens,
    served: d.served,
    noShows: report.advanced?.noShowTrend[i]?.noShows ?? null,
    avgWait: report.advanced?.dailyWait[i]?.avgWaitMinutes ?? null,
  }));
}

// Customers per hour (average per day over the range), trimmed to the hours that had anyone.
export function hourlyChart(report) {
  const rows = report.customersPerHour.map((h) => ({
    label: hourLabel(h.hour),
    customers: h.perDay,
    wait: report.advanced?.waitByHour[h.hour]?.avgWaitMinutes ?? null,
  }));
  const busy = report.customersPerHour.map((h, i) => (h.customers ? i : -1)).filter((i) => i >= 0);
  return busy.length ? rows.slice(busy[0], busy.at(-1) + 1) : [];
}

export const serviceChart = (report) => report.serviceSplit.map((s) => ({ name: s.name, value: s.tokens }));

export const performanceRows = (report) =>
  (report.advanced?.resourcePerformance ?? []).map((r) => ({
    id: r.resourceId,
    name: r.name,
    served: r.served,
    noShows: r.noShows,
    avgWait: r.avgWaitMinutes ?? '–',
    avgServe: r.avgServiceMinutes ?? '–',
    rating: r.rating ?? '–',
  }));
