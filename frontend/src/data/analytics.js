import { createRandom } from '../lib/random';
import { DAY_MS } from '../config/constants';
import { startOfDay } from '../lib/formatters';

// Pre-filled daily history so charts read well. Sample numbers only.
export function seedAnalytics(businesses, now = Date.now()) {
  const out = {};
  businesses.forEach((b, bi) => {
    const rnd = createRandom(500 + bi * 31);
    const base = b.isLive ? { biz_citycare: 22, biz_unitedbank: 40, biz_canteen: 55 }[b.id] ?? 50 : 0;
    const days = [];
    for (let d = 30; d >= 1; d--) {
      const date = startOfDay(now - d * DAY_MS);
      const dow = new Date(date).getDay();
      const factor = dow === 0 ? 0.45 : dow === 6 ? 0.75 : 1;
      const volume = Math.round(base * factor * (0.8 + rnd.next() * 0.4));
      days.push({
        date,
        volume,
        avgWait: base ? Math.round(6 + rnd.next() * 14) : 0,
        noShows: Math.round(volume * (0.04 + rnd.next() * 0.06)),
        avgServe: base ? Math.round(5 + rnd.next() * 8) : 0,
      });
    }
    const hourly = Array.from({ length: 13 }, (_, i) => {
      const hour = 8 + i;
      const peak = Math.exp(-((hour - 11.5) ** 2) / 6) + 0.7 * Math.exp(-((hour - 17) ** 2) / 4);
      return { hour, customers: Math.round((base / 8) * (0.3 + peak) * (0.85 + rnd.next() * 0.3)), wait: Math.round(4 + peak * 16 + rnd.next() * 3) };
    });
    out[b.id] = { days, hourly };
  });
  return out;
}
