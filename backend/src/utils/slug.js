import { RESERVED_SLUGS } from './constants.js';

// Same rules as frontend/src/lib/validators.js: 3 to 40 characters, lowercase letters,
// numbers, and hyphens, not starting or ending with a hyphen.
export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

// "City Care Clinic!" -> "city-care-clinic"
export const slugify = (text = '') =>
  text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
    .replace(/-$/, '');

// Returns a readable problem, or null when the slug is allowed.
export function slugProblem(slug) {
  if (!slug) return 'Enter a link name';
  if (slug.length < 3) return 'Use at least 3 characters';
  if (!SLUG_PATTERN.test(slug)) return 'Use lowercase letters, numbers, and hyphens. No hyphen at the start or end.';
  if (RESERVED_SLUGS.includes(slug)) return 'This name is reserved';
  return null;
}
