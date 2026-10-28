import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import path from 'node:path';
import { ApiError } from '../utils/ApiError.js';
import { hasFeature } from '../utils/constants.js';
import { logActivity } from './activity.service.js';
import { emitBusinessUpdated } from '../sockets/queue.socket.js';

// Logos are stored on this server's disk under backend/uploads/logos and served at /uploads.
// This suits development and a single server. Before running several servers in production,
// swap saveLogoFile/removeLogoFile for Cloudinary or S3 (Phase 16); nothing else changes.
export const UPLOAD_DIR = fileURLToPath(new URL('../../uploads/', import.meta.url));
const LOGO_DIR = path.join(UPLOAD_DIR, 'logos');
const LOGO_URL_PREFIX = '/uploads/logos/';
export const MAX_LOGO_BYTES = 400 * 1024;

// Identify images by their first bytes, not by the file name or the browser's claim.
// SVG is not accepted: it can carry scripts.
function detectImageType(buffer) {
  if (buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (buffer.length > 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

async function saveLogoFile(businessId, buffer) {
  const ext = detectImageType(buffer);
  if (!ext) throw ApiError.badRequest('INVALID_IMAGE', 'Upload a PNG, JPG, or WebP image');
  await mkdir(LOGO_DIR, { recursive: true });
  // A new name every upload, so browsers never show a cached old logo.
  const fileName = `${businessId}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
  await writeFile(path.join(LOGO_DIR, fileName), buffer);
  return `${LOGO_URL_PREFIX}${fileName}`;
}

async function removeLogoFile(url) {
  if (!url?.startsWith(LOGO_URL_PREFIX)) return; // not stored here (for example a future cloud URL)
  const fileName = path.basename(url);
  await unlink(path.join(LOGO_DIR, fileName)).catch(() => {}); // already gone is fine
}

/* -------------------------------------------------------- branding */

// What public pages should actually show. hidePoweredBy is stored as the owner set it,
// but only takes effect on plans that include removeBranding.
export function publicBranding(business) {
  const { logoUrl, brandColor, welcomeMessage, hidePoweredBy } = business.branding;
  return { logoUrl, brandColor, welcomeMessage, hidePoweredBy: Boolean(hidePoweredBy && hasFeature(business.plan, 'removeBranding')) };
}

export async function updateBranding(business, changes, actorId) {
  for (const [key, value] of Object.entries(changes)) business.branding[key] = value;
  business.setup.brandingSet = true;
  await business.save();
  emitBusinessUpdated(business);
  await logActivity({ businessId: business._id, actorId, kind: 'settings', text: 'Branding updated' });
  return business;
}

export async function setLogo(business, file, actorId) {
  if (!file) throw ApiError.badRequest('NO_FILE', 'Choose an image to upload (form field "logo")');
  const oldUrl = business.branding.logoUrl;
  business.branding.logoUrl = await saveLogoFile(business._id, file.buffer);
  business.setup.brandingSet = true;
  await business.save();
  emitBusinessUpdated(business);
  await removeLogoFile(oldUrl);
  await logActivity({ businessId: business._id, actorId, kind: 'settings', text: 'Logo updated' });
  return business;
}

export async function deleteLogo(business, actorId) {
  const oldUrl = business.branding.logoUrl;
  business.branding.logoUrl = '';
  await business.save();
  emitBusinessUpdated(business);
  await removeLogoFile(oldUrl);
  await logActivity({ businessId: business._id, actorId, kind: 'settings', text: 'Logo removed' });
  return business;
}
