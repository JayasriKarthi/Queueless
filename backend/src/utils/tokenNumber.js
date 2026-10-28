import { Queue } from '../models/Queue.js';

export const DEFAULT_TIME_ZONE = 'Asia/Kolkata';

// The calendar day in the business's time zone, as YYYY-MM-DD. A token taken at 00:30 in
// India belongs to that Indian day, even though it is still the previous day in UTC.
export function dateKey(date = new Date(), timeZone = DEFAULT_TIME_ZONE) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

// A-1 -> "A-001", T-1234 -> "T-1234"
export const formatCode = (prefix, number) => `${prefix}-${String(number).padStart(3, '0')}`;

// The next token number for a business, prefix, and day: 1, 2, 3... restarting each day.
// Also returns `total`, the business's number of tokens today across every prefix, used for
// the daily limit.
//
// MongoDB's $inc on a single document is atomic, so two customers joining in the same
// millisecond always get different numbers. Pass `session` to take the number inside the
// join transaction: if saving the token fails (or the daily limit is hit), the number and
// the total are not used up either.
export async function nextTokenNumber({ businessId, prefix, timeZone = DEFAULT_TIME_ZONE, session, now = new Date() }) {
  const date = dateKey(now, timeZone);
  const filter = { businessId, queueKey: 'all', date };
  // Prefixes are capital letters, so the lowercase "total" key can never clash with one.
  const update = { $inc: { [`counters.${prefix}`]: 1, 'counters.total': 1 } };

  // The first token of the day creates the document. If two requests create it at the
  // same instant, one hits the unique index (outside a transaction) and simply retries;
  // inside a transaction, MongoDB reports a write conflict and the transaction retries.
  for (let attempt = 1; ; attempt += 1) {
    try {
      const doc = await Queue.findOneAndUpdate(filter, update, { upsert: true, returnDocument: 'after', session });
      const number = doc.counters.get(prefix);
      return { number, code: formatCode(prefix, number), date, total: doc.counters.get('total') };
    } catch (err) {
      if (err.code === 11000 && !session && attempt < 3) continue;
      throw err;
    }
  }
}
