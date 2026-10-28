import { Resource } from '../models/Resource.js';
import { ApiError } from '../utils/ApiError.js';
import { planLimit } from '../utils/constants.js';

// How much of each limit a business is using right now. Phase 11 adds staffSeats,
// Phase 9 adds tokensPerDay.
const COUNTERS = {
  counters: (businessId) => Resource.countDocuments({ businessId, isActive: true }),
};

// Throws 403 PLAN_LIMIT if adding `adding` more would go over the plan's limit.
// Limits only block additions: a business already over its limit (for example after a
// downgrade) keeps everything and can still edit, rename, or switch things off.
export async function assertWithinLimit(business, limitKey, adding = 1) {
  if (adding <= 0) return;
  const limit = planLimit(business.plan, limitKey);
  if (limit === Infinity) return;
  const used = await COUNTERS[limitKey](business._id);
  if (used + adding > limit) {
    throw ApiError.forbidden('PLAN_LIMIT', `Your plan allows ${limit} active ${limitKey}. Upgrade to add more.`, { limitKey, used, limit });
  }
}

// Route middleware: enforceLimit('counters', (req) => how many this request adds).
// Use after tenantScope. The function may be async and may return 0 when nothing is added.
export const enforceLimit = (limitKey, adding = () => 1) => async (req, res, next) => {
  await assertWithinLimit(req.business, limitKey, await adding(req));
  next();
};

export default enforceLimit;
