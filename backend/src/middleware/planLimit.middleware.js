import { Resource } from '../models/Resource.js';
import { User } from '../models/User.js';
import { StaffInvite } from '../models/StaffInvite.js';
import { ApiError, ERROR_CODES } from '../utils/ApiError.js';
import { planLimit, STAFF_ROLES } from '../utils/constants.js';

// How much of each limit a business is using right now. (Tokens per day are counted
// atomically inside the join itself; see token.service.js.)
const COUNTERS = {
  // Active resources: doctors, counters, or stylists that are switched on.
  counters: (businessId) => Resource.countDocuments({ businessId, isActive: true }),
  // Active staff and managers, plus invites still waiting to be accepted. Owners are free.
  staffSeats: async (businessId) => {
    const [people, invites] = await Promise.all([
      User.countDocuments({ businessId, role: { $in: STAFF_ROLES }, status: 'active' }),
      StaffInvite.countDocuments({ businessId, status: 'pending', expiresAt: { $gt: new Date() } }),
    ]);
    return people + invites;
  },
};

// The error code the frontend expects for each limit.
const LIMIT_CODES = { counters: 'PLAN_LIMIT', staffSeats: ERROR_CODES.SEAT_LIMIT };
const LIMIT_MESSAGES = {
  counters: (limit) => `Your plan allows ${limit} active ${limit === 1 ? 'counter' : 'counters'}. Upgrade to add more.`,
  staffSeats: (limit) => `Your plan includes ${limit} staff ${limit === 1 ? 'seat' : 'seats'}, and all are in use. Upgrade, or free a seat first.`,
};

export const usageOf = (business, limitKey) => COUNTERS[limitKey](business._id);

// Throws 403 if adding `adding` more would go over the plan's limit.
// Limits only block additions: a business already over its limit (for example after a
// downgrade) keeps everything and can still edit, rename, or switch things off.
export async function assertWithinLimit(business, limitKey, adding = 1) {
  if (adding <= 0) return;
  const limit = planLimit(business.plan, limitKey);
  if (limit === Infinity) return;
  const used = await usageOf(business, limitKey);
  if (used + adding > limit) {
    throw ApiError.forbidden(LIMIT_CODES[limitKey], LIMIT_MESSAGES[limitKey](limit), { limitKey, used, limit });
  }
}

// Route middleware: enforceLimit('counters', (req) => how many this request adds).
// Use after tenantScope. The function may be async and may return 0 when nothing is added.
export const enforceLimit = (limitKey, adding = () => 1) => async (req, res, next) => {
  await assertWithinLimit(req.business, limitKey, await adding(req));
  next();
};

export default enforceLimit;
