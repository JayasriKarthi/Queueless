import { Business } from '../models/Business.js';
import { Token } from '../models/Token.js';
import { TOKEN_STATUS } from '../utils/constants.js';
import { transition } from '../services/token.service.js';

// Every 30 seconds. For businesses that turned on settings.autoNoShow: a customer still
// "called" after the business's noShowMinutes is marked as a no-show (staff can also do it
// by hand). "Recall" resets calledAt, so a recalled customer gets the full time again.
// Returns how many tokens were marked.
export async function runNoShowJob(now = new Date()) {
  const businesses = await Business.find({ isLive: true, 'settings.autoNoShow': true });
  let marked = 0;
  for (const business of businesses) {
    const cutoff = new Date(now.getTime() - business.settings.noShowMinutes * 60000);
    const overdue = await Token.find({ businessId: business._id, status: TOKEN_STATUS.CALLED, calledAt: { $lt: cutoff } }).select('_id');
    for (const { _id } of overdue) {
      try {
        // Same rules and live updates as a staff member pressing "No-show".
        await transition(business, _id, 'noShow');
        marked += 1;
      } catch (err) {
        if (err.code !== 'INVALID_TRANSITION') throw err; // they arrived, or staff acted, just now
      }
    }
  }
  return { marked };
}
