import { Business } from '../models/Business.js';
import { Token } from '../models/Token.js';
import { ACTIVE_STATUSES, CUSTOMER_DATA_RETENTION_DAYS, DAY_MS } from '../utils/constants.js';
import { dateKey, DEFAULT_TIME_ZONE } from '../utils/tokenNumber.js';

// Daily at 03:00. Each part is independent, so one failing does not stop the others.
// Two things the guide lists need no job here: expired invites count as expired the moment
// their date passes (no change needed), and old activity logs are removed by MongoDB itself
// (a 180-day expiry index on ActivityLog).

// 1. Tokens still waiting, called, or being served from a previous day (the business closed
// with people in line). They are cancelled, and their phones are freed to join again.
async function cancelLeftovers(now) {
  const businessIds = await Token.distinct('businessId', { status: { $in: ACTIVE_STATUSES } });
  const businesses = await Business.find({ _id: { $in: businessIds } }).select('timeZone');
  let cancelled = 0;
  for (const business of businesses) {
    const today = dateKey(now, business.timeZone);
    const { modifiedCount } = await Token.updateMany(
      { businessId: business._id, status: { $in: ACTIVE_STATUSES }, day: { $lt: today } },
      [{ $set: { status: 'CANCELLED', cancelledAt: now, cancelledBy: 'system' } }, { $unset: 'activePhone' }],
      { updatePipeline: true },
    );
    cancelled += modifiedCount;
  }
  return cancelled;
}

// 2. Customers' phone numbers are only needed for the visit. After the retention period,
// they are removed from old tokens (the rest of the history stays for analytics).
async function anonymisePhones(now) {
  const { modifiedCount } = await Token.updateMany(
    { createdAt: { $lt: new Date(now.getTime() - CUSTOMER_DATA_RETENTION_DAYS * DAY_MS) }, 'customer.phone': { $type: 'string' } },
    { $set: { 'customer.phone': null } }, // the "phone is required" rule applies when a token is created
  );
  return modifiedCount;
}

// 3. SMS credits are per calendar month (in each business's time zone): start each month at 0.
async function resetMonthlySms(now) {
  const zones = await Business.distinct('timeZone');
  let reset = 0;
  for (const zone of zones.length ? zones : [DEFAULT_TIME_ZONE]) {
    const month = dateKey(now, zone || DEFAULT_TIME_ZONE).slice(0, 7);
    const { modifiedCount } = await Business.updateMany({ timeZone: zone, smsMonth: { $ne: month } }, { $set: { smsUsed: 0, smsMonth: month } });
    reset += modifiedCount;
  }
  return reset;
}

export async function runCleanup(now = new Date()) {
  const results = {};
  for (const [name, part] of [['leftoverTokensCancelled', cancelLeftovers], ['phonesRemoved', anonymisePhones], ['smsCountersReset', resetMonthlySms]]) {
    try {
      results[name] = await part(now);
    } catch (err) {
      console.error(`Cleanup step "${name}" failed`, err);
      results[name] = null;
    }
  }
  return results;
}
