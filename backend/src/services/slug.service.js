import mongoose from 'mongoose';
import { Business } from '../models/Business.js';
import { SlugHistory } from '../models/SlugHistory.js';
import { slugify, slugProblem } from '../utils/slug.js';
import { ApiError } from '../utils/ApiError.js';
import { RESERVED_SLUGS, SLUG_REDIRECT_DAYS, DAY_MS } from '../utils/constants.js';
import { logActivity } from './activity.service.js';
import { emitBusinessUpdated } from '../sockets/queue.socket.js';

// A slug is taken if another business uses it now, or still redirects from it.
export async function isSlugTaken(slug, exceptBusinessId) {
  const notMine = exceptBusinessId ? { $ne: exceptBusinessId } : { $exists: true };
  const [current, redirect] = await Promise.all([
    Business.exists({ slug, _id: notMine }),
    SlugHistory.exists({ slug, redirectUntil: { $gt: new Date() }, businessId: notMine }),
  ]);
  return Boolean(current || redirect);
}

// Finds the business for a public slug (customer pages, TV displays, their sockets).
// Returns { business }, or { business, movedTo } for an old slug still in its redirect window,
// or {} when nothing matches. Reserved words never match.
export async function resolvePublicSlug(rawSlug) {
  const slug = String(rawSlug ?? '').toLowerCase();
  if (!slug || RESERVED_SLUGS.includes(slug)) return {};
  const business = await Business.findOne({ slug });
  if (business) return { business };
  const moved = await SlugHistory.findOne({ slug, redirectUntil: { $gt: new Date() } });
  const target = moved && (await Business.findById(moved.businessId));
  return target ? { business: target, movedTo: target.slug } : {};
}

// A free slug from a business name: "City Care" -> "city-care", or "city-care-2" if taken.
export async function uniqueSlug(name) {
  let base = slugify(name) || 'my-queue';
  if (base.length < 3) base = `${base}-queue`;
  let candidate = base;
  for (let n = 2; RESERVED_SLUGS.includes(candidate) || (await isSlugTaken(candidate)); n += 1) {
    candidate = `${base.slice(0, 36)}-${n}`;
  }
  return candidate;
}

// For the live check under the link field in Settings.
// A business may take back one of its own old slugs.
export async function checkAvailability(slug, business) {
  const problem = slugProblem(slug);
  if (problem) return { available: false, reason: problem };
  if (slug === business.slug) return { available: true, current: true, reason: 'This is your current link' };
  if (await isSlugTaken(slug, business._id)) return { available: false, reason: 'Already taken by another business' };
  return { available: true, reason: 'Available' };
}

// Old links of this business that still redirect, for "Old links still redirecting" in Settings.
export const activeHistory = (businessId) =>
  SlugHistory.find({ businessId, redirectUntil: { $gt: new Date() } }).sort({ redirectUntil: -1 }).select('slug redirectUntil -_id');

export async function changeSlug(business, newSlug, { confirmBreakingQr = false, actorId } = {}) {
  const check = await checkAvailability(newSlug, business);
  if (!check.available) {
    const invalid = Boolean(slugProblem(newSlug));
    throw invalid ? ApiError.badRequest('INVALID_SLUG', check.reason) : ApiError.conflict('SLUG_TAKEN', check.reason);
  }

  // Same slug: this is the go-live checklist's "Confirm your link".
  if (check.current) {
    business.setup.slugConfirmed = true;
    await business.save();
    return business;
  }

  if (business.isLive && !confirmBreakingQr) {
    throw ApiError.badRequest(
      'CONFIRM_REQUIRED',
      `Your printed QR codes will stop working. We will keep redirecting your old link for ${SLUG_REDIRECT_DAYS} days. Confirm to continue.`,
    );
  }

  const oldSlug = business.slug;
  await mongoose.connection.transaction(async (session) => {
    // Printed QR codes only exist after go live, so only then does the old link need a redirect.
    // Upsert: an expired entry for this slug (waiting for the TTL cleanup) is simply reused.
    if (business.isLive) {
      await SlugHistory.findOneAndUpdate(
        { slug: oldSlug },
        { businessId: business._id, redirectUntil: new Date(Date.now() + SLUG_REDIRECT_DAYS * DAY_MS) },
        { upsert: true, session },
      );
    }
    // Taking back one of this business's own old links ends its redirect.
    await SlugHistory.deleteOne({ slug: newSlug, businessId: business._id }, { session });

    business.slug = newSlug;
    business.setup.slugConfirmed = true;
    await business.save({ session });
    await logActivity({ businessId: business._id, actorId, kind: 'settings', text: `Link changed from ${oldSlug} to ${newSlug}` }, session);
  });
  // Open join pages and TVs learn the new link (they stay connected: rooms use the business id).
  emitBusinessUpdated(business);
  return business;
}
