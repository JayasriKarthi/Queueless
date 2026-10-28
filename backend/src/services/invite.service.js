import crypto from 'node:crypto';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { Business } from '../models/Business.js';
import { Resource } from '../models/Resource.js';
import { StaffInvite } from '../models/StaffInvite.js';
import { ApiError, ERROR_CODES } from '../utils/ApiError.js';
import { STAFF_ROLES, INVITE_EXPIRY_DAYS, DAY_MS, planLimit } from '../utils/constants.js';
import { assertWithinLimit, usageOf } from '../middleware/planLimit.middleware.js';
import { scoped } from './tenant.service.js';
import { logActivity } from './activity.service.js';
import { sendEmail } from './notification.service.js';
import { disconnectUser } from '../sockets/index.js';

const BCRYPT_COST = 12;
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const INVALID_LINK = () => ApiError.gone(ERROR_CODES.INVALID, 'This invite link is no longer valid');

// pending + not expired = "Invited"; pending + past expiry = "Expired".
export function inviteStatus(invite, now = Date.now()) {
  if (invite.status !== 'pending') return invite.status; // accepted or revoked
  return invite.expiresAt.getTime() <= now ? 'expired' : 'invited';
}

const inviteLink = (token) => `${env.CLIENT_URL}/accept-invite/${token}`;

// There is no email provider yet (Phase 14), so outside production the link is also returned
// in the API response, like the frontend's "mock email preview". Never in production.
const devLink = (token) => (env.NODE_ENV === 'production' ? {} : { devInviteLink: inviteLink(token) });

async function emailInvite(business, invite, token) {
  await sendEmail({
    to: invite.email,
    subject: `Join ${business.name} on QueueLess`,
    text: `You have been invited to join ${business.name} on QueueLess as ${invite.role === 'manager' ? 'a manager' : 'staff'}.\n\nSet your password here (the link expires in ${INVITE_EXPIRY_DAYS} days):\n${inviteLink(token)}\n\nYou will log in at the normal QueueLess login page.`,
  });
}

// A fresh random token: only its hash is stored, so a database leak exposes no working link.
function freshToken() {
  const token = nanoid(32);
  return { token, tokenHash: sha256(token), expiresAt: new Date(Date.now() + INVITE_EXPIRY_DAYS * DAY_MS) };
}

const counts = (invite, now) => invite.status === 'pending' && invite.expiresAt.getTime() > now;

/* ------------------------------------------------------------- list */

// GET /api/admin/staff: staff and managers, plus invites not yet accepted, and seat usage.
export async function listStaff(business) {
  const now = Date.now();
  const [users, invites, resources, used] = await Promise.all([
    User.find({ businessId: business._id, role: { $in: STAFF_ROLES } }).sort({ createdAt: 1 }),
    scoped(StaffInvite, business._id).find({ status: { $ne: 'accepted' } }).sort({ createdAt: -1 }),
    scoped(Resource, business._id).find().select('name'),
    usageOf(business, 'staffSeats'),
  ]);
  const resourceView = (id) => {
    const r = id && resources.find((x) => x._id.equals(id));
    return r ? { id: r.id, name: r.name } : null;
  };

  const people = users.map((u) => ({
    kind: 'user',
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    resource: resourceView(u.resourceId),
    status: u.status === 'active' ? 'active' : 'deactivated',
    lastLoginAt: u.lastLoginAt ?? null,
    avatarColor: u.avatarColor,
  }));
  const pending = invites.map((i) => {
    const status = inviteStatus(i, now);
    return {
      kind: 'invite',
      id: i.id,
      name: null,
      email: i.email,
      role: i.role,
      resource: resourceView(i.resourceId),
      status,
      expiresAt: i.expiresAt,
      daysLeft: status === 'invited' ? Math.ceil((i.expiresAt.getTime() - now) / DAY_MS) : 0,
    };
  });
  return { staff: [...people, ...pending], seats: { used, limit: planLimit(business.plan, 'staffSeats') === Infinity ? null : planLimit(business.plan, 'staffSeats') } };
}

/* ------------------------------------------------------ owner actions */

// POST /api/admin/invites
export async function createInvite(business, { email, role, resourceId }, actorId) {
  if (await User.exists({ email })) {
    throw ApiError.conflict('EMAIL_TAKEN', 'Someone with this email already has a QueueLess account');
  }
  if (!(await scoped(Resource, business._id).exists({ _id: resourceId }))) {
    throw ApiError.notFound('NOT_FOUND', `${business.labels.resource} not found`);
  }

  const now = Date.now();
  const previous = await scoped(StaffInvite, business._id).findOne({ email, status: { $ne: 'accepted' } });
  if (previous && counts(previous, now)) {
    throw ApiError.conflict('INVITE_PENDING', 'This person already has a pending invite. Use Resend instead.');
  }
  await assertWithinLimit(business, 'staffSeats', 1);

  // An expired or revoked invite for the same person is reused, so the Staff table shows one row.
  const { token, ...fresh } = freshToken();
  const fields = { email, role, resourceId, status: 'pending', invitedBy: actorId, ...fresh };
  const invite = previous
    ? await StaffInvite.findOneAndUpdate({ _id: previous._id, businessId: business._id }, { $set: fields, $unset: { revokedAt: 1 } }, { returnDocument: 'after' })
    : await scoped(StaffInvite, business._id).create(fields);

  await emailInvite(business, invite, token);
  await logActivity({ businessId: business._id, actorId, kind: 'invite', text: `Invite sent to ${email}` });
  return { invite, ...devLink(token) };
}

// POST /api/admin/invites/:id/resend: a new link and a new 7 days; the old link stops working.
export async function resendInvite(business, inviteId, actorId) {
  const invite = await scoped(StaffInvite, business._id).findById(inviteId);
  if (!invite) throw ApiError.notFound('NOT_FOUND', 'Invite not found');
  if (invite.status === 'accepted') throw ApiError.conflict('INVITE_ACCEPTED', 'This invite has already been accepted');
  if (await User.exists({ email: invite.email })) throw ApiError.conflict('EMAIL_TAKEN', 'Someone with this email already has a QueueLess account');

  // An expired or revoked invite no longer holds a seat, so taking one back needs a free seat.
  if (!counts(invite, Date.now())) await assertWithinLimit(business, 'staffSeats', 1);

  const { token, ...fresh } = freshToken();
  Object.assign(invite, fresh, { status: 'pending', revokedAt: undefined });
  await invite.save();
  await emailInvite(business, invite, token);
  await logActivity({ businessId: business._id, actorId, kind: 'invite', text: `Invite resent to ${invite.email}` });
  return { invite, ...devLink(token) };
}

// POST /api/admin/invites/:id/revoke: the link stops working and the seat is freed.
export async function revokeInvite(business, inviteId, actorId) {
  const invite = await scoped(StaffInvite, business._id).findById(inviteId);
  if (!invite) throw ApiError.notFound('NOT_FOUND', 'Invite not found');
  if (invite.status === 'accepted') throw ApiError.conflict('INVITE_ACCEPTED', 'This invite has already been accepted. Deactivate the person instead.');
  if (invite.status !== 'revoked') {
    invite.status = 'revoked';
    invite.revokedAt = new Date();
    await invite.save();
    await logActivity({ businessId: business._id, actorId, kind: 'invite', text: `Invite for ${invite.email} revoked` });
  }
  return { invite };
}

/* --------------------------------------------------- managing staff */

// A staff member or manager of this business. Owners are never managed through these routes.
async function findStaff(business, userId) {
  const user = mongoose.isValidObjectId(userId) ? await User.findOne({ _id: userId, businessId: business._id, role: { $in: STAFF_ROLES } }) : null;
  if (!user) throw ApiError.notFound('NOT_FOUND', 'Staff member not found');
  return user;
}

// PATCH /api/admin/staff/:id  { resourceId?, role? }
export async function updateStaff(business, userId, { resourceId, role }, actorId) {
  const user = await findStaff(business, userId);
  if (resourceId && !(await scoped(Resource, business._id).exists({ _id: resourceId }))) {
    throw ApiError.notFound('NOT_FOUND', `${business.labels.resource} not found`);
  }
  if (resourceId !== undefined) user.resourceId = resourceId; // null unassigns
  if (role !== undefined) user.role = role;
  await user.save();
  await logActivity({ businessId: business._id, actorId, kind: 'staff', text: `Updated ${user.name}` });
  return user;
}

// POST /api/admin/staff/:id/reset-pin: a new random PIN, returned once for the owner to pass on.
export async function resetPin(business, userId, actorId) {
  const user = await findStaff(business, userId);
  const pin = String(crypto.randomInt(1000, 10000));
  user.pinHash = await bcrypt.hash(pin, BCRYPT_COST);
  await user.save();
  await logActivity({ businessId: business._id, actorId, kind: 'staff', text: `PIN reset for ${user.name}` });
  return { user, pin };
}

// POST /api/admin/staff/:id/deactivate: they can no longer log in, and every session ends now.
// The history they created (tokens served, activity) is kept.
export async function deactivateStaff(business, userId, actorId) {
  const user = await findStaff(business, userId);
  if (user.status !== 'deactivated') {
    user.status = 'deactivated';
    user.refreshTokenVersion += 1; // every refresh token they hold stops working
    await user.save();
    disconnectUser(user.id); // and open live connections close now (access tokens fail on their next request)
    await logActivity({ businessId: business._id, actorId, kind: 'staff', text: `${user.name} was deactivated` });
  }
  return user;
}

// POST /api/admin/staff/:id/reactivate: needs a free seat, like a new invite.
export async function reactivateStaff(business, userId, actorId) {
  const user = await findStaff(business, userId);
  if (user.status !== 'active') {
    await assertWithinLimit(business, 'staffSeats', 1);
    user.status = 'active';
    await user.save();
    await logActivity({ businessId: business._id, actorId, kind: 'staff', text: `${user.name} was reactivated` });
  }
  return user;
}

/* --------------------------------------------------- invitee actions */

// Only a pending, unexpired invite of an existing business is valid.
async function findUsableInvite(token) {
  const invite = await StaffInvite.findOne({ tokenHash: sha256(token), status: 'pending', expiresAt: { $gt: new Date() } });
  const business = invite && (await Business.findById(invite.businessId));
  if (!invite || !business) throw INVALID_LINK();
  return { invite, business };
}

// GET /api/invites/:token: what the "You have been invited" page shows.
export async function describeInvite(token) {
  const { invite, business } = await findUsableInvite(token);
  const resource = invite.resourceId && (await Resource.findOne({ _id: invite.resourceId, businessId: business._id }).select('name'));
  return {
    business: { name: business.name, logoUrl: business.branding.logoUrl, brandColor: business.branding.brandColor },
    email: invite.email,
    role: invite.role,
    resource: resource ? { id: resource.id, name: resource.name, label: business.labels.resource } : null,
    expiresAt: invite.expiresAt,
  };
}

// POST /api/invites/:token/accept: creates the staff account and uses up the link.
export async function acceptInvite(token, { name, password, pin }) {
  const { invite, business } = await findUsableInvite(token);
  if (await User.exists({ email: invite.email })) {
    throw ApiError.conflict('EMAIL_TAKEN', 'An account with this email already exists. Please log in.');
  }

  // Slow hashing happens before the transaction, so it stays short.
  const finalPin = pin ?? String(crypto.randomInt(1000, 10000));
  const [passwordHash, pinHash] = await Promise.all([bcrypt.hash(password, BCRYPT_COST), bcrypt.hash(finalPin, BCRYPT_COST)]);

  let user;
  await mongoose.connection.transaction(async (session) => {
    // Marking the invite accepted only matches while it is still pending and unexpired,
    // so two "Create my account" clicks at once cannot both use the same link.
    const claimed = await StaffInvite.findOneAndUpdate(
      { _id: invite._id, status: 'pending', expiresAt: { $gt: new Date() } },
      { $set: { status: 'accepted', acceptedAt: new Date() } },
      { session, returnDocument: 'after' },
    );
    if (!claimed) throw INVALID_LINK();

    [user] = await User.create(
      [{
        name, email: invite.email, passwordHash, pinHash, role: invite.role,
        businessId: invite.businessId, resourceId: invite.resourceId ?? null,
        lastLoginAt: new Date(), avatarColor: '#0E9F8E',
      }],
      { session },
    );
    await StaffInvite.updateOne({ _id: invite._id }, { $set: { userId: user._id } }, { session });
    await logActivity({ businessId: business._id, actorId: user._id, kind: 'staff', text: `${user.name} accepted their invite` }, session);
  });

  // A PIN the person did not choose is shown once, so they can write it down.
  return { user, business, ...(pin ? {} : { generatedPin: finalPin }) };
}
