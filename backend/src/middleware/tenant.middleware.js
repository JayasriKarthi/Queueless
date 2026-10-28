import { Business } from '../models/Business.js';
import { SlugHistory } from '../models/SlugHistory.js';
import { ApiError } from '../utils/ApiError.js';
import { resolvePublicSlug } from '../services/slug.service.js';

const ACCESS_DENIED = () =>
  ApiError.forbidden('ACCESS_DENIED', "Your account belongs to a different business, so you cannot see this business's data.");

// Owner, manager, and staff routes. Use after requireAuth.
// The business always comes from the logged-in user, never from the URL or the body.
// If the request asks for a different business, refuse it (the frontend's "Access denied" screen).
export async function tenantScope(req, res, next) {
  const business = await Business.findById(req.user.businessId);
  if (!business) throw ApiError.notFound('BUSINESS_NOT_FOUND', 'This business no longer exists');

  // ?business=<slug>: allowed only for this business's current slug or one of its old ones.
  const requestedSlug = typeof req.query.business === 'string' ? req.query.business.toLowerCase() : null;
  if (requestedSlug && requestedSlug !== business.slug) {
    const ownOldSlug = await SlugHistory.exists({ slug: requestedSlug, businessId: business._id });
    if (!ownOldSlug) throw ACCESS_DENIED();
  }

  // A businessId in the body must match the session's (it is never used to pick the business).
  if (req.body?.businessId !== undefined && String(req.body.businessId) !== String(business._id)) throw ACCESS_DENIED();

  req.business = business;
  req.businessId = business._id;
  next();
}

// Customer and TV routes: /api/public/:slug/... and /api/display/:slug.
// Finds the business by slug. An old slug still in its 90-day window answers 308 with the
// new location, so printed QR codes keep working. Reserved or unknown slugs answer 404.
export async function publicBusiness(req, res, next) {
  const { business, movedTo } = await resolvePublicSlug(req.params.slug);
  if (!business) throw ApiError.notFound('BUSINESS_NOT_FOUND', 'We could not find this business');

  if (!movedTo) {
    req.business = business;
    req.businessId = business._id;
    return next();
  }

  // Same path with the new slug, for example /api/public/college-canteen/tokens -> /api/public/campus-canteen/tokens.
  const location = req.originalUrl.replace(`/${req.params.slug}`, `/${movedTo}`);
  res.status(308).location(location).json({ ok: false, redirectTo: movedTo, location });
}
