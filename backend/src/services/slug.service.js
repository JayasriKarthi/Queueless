import { Business } from '../models/Business.js';
import { SlugHistory } from '../models/SlugHistory.js';
import { slugify } from '../utils/slug.js';
import { RESERVED_SLUGS } from '../utils/constants.js';

// A slug is taken if another business uses it now, or still redirects from it.
export async function isSlugTaken(slug, exceptBusinessId) {
  const notMine = exceptBusinessId ? { $ne: exceptBusinessId } : { $exists: true };
  const [current, redirect] = await Promise.all([
    Business.exists({ slug, _id: notMine }),
    SlugHistory.exists({ slug, redirectUntil: { $gt: new Date() }, businessId: notMine }),
  ]);
  return Boolean(current || redirect);
}

// A free slug from a business name: "City Care" -> "city-care", or "city-care-2" if taken.
// Phase 7 adds checkAvailability and changeSlug to this file.
export async function uniqueSlug(name) {
  let base = slugify(name) || 'my-queue';
  if (base.length < 3) base = `${base}-queue`;
  let candidate = base;
  for (let n = 2; RESERVED_SLUGS.includes(candidate) || (await isSlugTaken(candidate)); n += 1) {
    candidate = `${base.slice(0, 36)}-${n}`;
  }
  return candidate;
}
