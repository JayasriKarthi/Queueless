import { redis } from '../config/redis.js';
import { dateKey, DEFAULT_TIME_ZONE } from '../utils/tokenNumber.js';
import { localNow } from '../utils/hours.js';
import { runNoShowJob } from './noShow.job.js';
import { runInviteReminders, runDailySummaries } from './reminder.job.js';
import { runCleanup } from './cleanup.job.js';

// A small scheduler in the same process as the API (move it to its own worker process when
// traffic grows). Jobs run outside Express, so every run is wrapped and failures are logged.
//
// With several servers, every instance runs these timers, so each run first claims a Redis
// lock: only one instance does the work. Daily jobs are claimed once per date, so a server
// that was down at 03:00 still runs the cleanup when it comes back.

const SCHEDULE_ZONE = DEFAULT_TIME_ZONE; // daily times below are in this time zone
const timers = [];

async function claim(key, seconds) {
  return (await redis.set(`job:${key}`, String(process.pid), 'EX', seconds, 'NX')) === 'OK';
}

async function safely(name, task) {
  try {
    const result = await task();
    if (result && process.env.NODE_ENV !== 'test') console.info(`[job] ${name}`, JSON.stringify(result));
  } catch (err) {
    console.error(`[job] ${name} failed`, err);
  }
}

// Every `ms`, by one instance per time window.
function every(ms, name, task) {
  timers.push(
    setInterval(() => safely(name, async () => ((await claim(`${name}:${Math.floor(Date.now() / ms)}`, Math.ceil(ms / 1000))) ? task() : null)), ms),
  );
}

// Once a day, at or after HH:MM, by one instance.
function dailyAt(time, name, task) {
  timers.push(
    setInterval(() => safely(name, async () => {
      if (localNow(SCHEDULE_ZONE).time < time) return null;
      return (await claim(`${name}:${dateKey(new Date(), SCHEDULE_ZONE)}`, 26 * 3600)) ? task() : null;
    }), 60 * 1000),
  );
}

export function startJobs() {
  every(30 * 1000, 'no-shows', () => runNoShowJob());
  every(60 * 1000, 'invite-reminders', () => runInviteReminders());
  dailyAt('08:00', 'daily-summaries', () => runDailySummaries());
  dailyAt('03:00', 'cleanup', () => runCleanup());
  timers.forEach((t) => t.unref?.()); // never keep the process alive just for jobs
}

export function stopJobs() {
  timers.splice(0).forEach(clearInterval);
}
