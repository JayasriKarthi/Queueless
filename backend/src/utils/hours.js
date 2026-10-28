import { DEFAULT_TIME_ZONE } from './tokenNumber.js';

const WEEKDAYS = { Mon: 'mon', Tue: 'tue', Wed: 'wed', Thu: 'thu', Fri: 'fri', Sat: 'sat', Sun: 'sun' };

// The weekday ("mon") and time ("14:05") right now in the business's time zone.
export function localNow(timeZone = DEFAULT_TIME_ZONE, date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return { day: WEEKDAYS[parts.weekday], time: `${parts.hour}:${parts.minute}` };
}

// Today's opening hours, and whether the business is inside them right now.
// (Shown on the join page only; the owner's open/closed switch decides who can join.)
export function todayHours(hours, timeZone, date = new Date()) {
  const { day, time } = localNow(timeZone, date);
  const today = hours?.[day];
  const open = Boolean(today?.open);
  return { day, open, from: today?.from ?? null, to: today?.to ?? null, openNow: open && today.from <= time && time < today.to };
}
