import crypto from 'node:crypto';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { Business } from '../models/Business.js';
import { Service } from '../models/Service.js';
import { Resource } from '../models/Resource.js';
import { ActivityLog } from '../models/ActivityLog.js';
import { ApiError } from '../utils/ApiError.js';
import { ROLES } from '../utils/constants.js';
import { templateFor } from '../utils/templates.js';
import { uniqueSlug } from './slug.service.js';
import { sendEmail } from './notification.service.js';

const BCRYPT_COST = 12;
const { ObjectId } = mongoose.Types;

/* ----------------------------------------------------------- tokens */

// Access token: 15 minutes, payload { sub: userId, businessId, role }, kept in the frontend's memory.
// Refresh token: 30 days, payload { sub, v }, kept in an HTTP-only cookie. Bumping the user's
// refreshTokenVersion makes every refresh token issued before it stop working.
export function issueTokens(user) {
  const accessToken = jwt.sign({ businessId: String(user.businessId), role: user.role }, env.JWT_ACCESS_SECRET, {
    subject: String(user._id),
    expiresIn: env.JWT_ACCESS_TTL,
  });
  const refreshToken = jwt.sign({ v: user.refreshTokenVersion }, env.JWT_REFRESH_SECRET, {
    subject: String(user._id),
    expiresIn: env.JWT_REFRESH_TTL,
  });
  return { accessToken, refreshToken };
}

export const homeFor = (role) => (role === ROLES.OWNER ? '/admin' : '/staff');

/* ------------------------------------------------------------ login */

const INVALID_LOGIN = 'Incorrect email or password.';
const DEACTIVATED = 'This account has been deactivated. Ask your business owner to restore access.';
// Compared against when the email is unknown, so both cases take the same time to answer.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_COST);

export async function login({ email, password }) {
  const user = await User.findOne({ email });
  const passwordOk = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  // Same answer for "no such user" and "wrong password", so nobody can probe which emails exist.
  if (!user || !passwordOk) throw ApiError.unauthorized('INVALID_LOGIN', INVALID_LOGIN);
  if (user.status !== 'active') throw ApiError.forbidden('ACCOUNT_DEACTIVATED', DEACTIVATED);

  user.lastLoginAt = new Date();
  await user.save();
  return user;
}

/* ---------------------------------------------- refresh and logout */

// Returns the payload of a valid refresh token, or null if it is missing, expired, or tampered with.
function readRefreshToken(token) {
  if (!token) return null;
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET, { algorithms: ['HS256'] });
  } catch {
    return null;
  }
}

// A refresh token only works while the user is active and its version matches the user's current one.
export async function refresh(refreshToken) {
  const payload = readRefreshToken(refreshToken);
  const user = payload && (await User.findById(payload.sub));
  if (!user || user.status !== 'active' || payload.v !== user.refreshTokenVersion) {
    throw ApiError.unauthorized('SESSION_EXPIRED', 'Your session has ended. Please log in again.');
  }
  return user;
}

// Logs the user out on every device by invalidating all their refresh tokens.
export async function logout(refreshToken) {
  const payload = readRefreshToken(refreshToken);
  if (payload) await User.updateOne({ _id: payload.sub }, { $inc: { refreshTokenVersion: 1 } });
}

/* -------------------------------------------------- forgot password */

const RESET_LINK_MINUTES = 60;
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

// Always behaves the same from the outside, so it never reveals whether an email has an account.
export async function requestPasswordReset(email) {
  const user = await User.findOne({ email, status: 'active' });
  if (!user) return;

  // Only the hash is stored; the plain token exists only in the emailed link.
  // A new request replaces any earlier link, so only the latest one works.
  const token = crypto.randomBytes(32).toString('base64url');
  user.resetTokenHash = sha256(token);
  user.resetTokenExpiresAt = new Date(Date.now() + RESET_LINK_MINUTES * 60 * 1000);
  await user.save();

  await sendEmail({
    to: user.email,
    subject: 'Reset your QueueLess password',
    text: `Hi ${user.name},\n\nUse this link to set a new password. It works once and expires in 1 hour:\n${env.CLIENT_URL}/reset-password/${token}\n\nIf you did not ask for this, you can ignore this email.`,
  });
}

// Sets the new password, uses up the link, and logs the user out on every device.
export async function resetPassword({ token, password }) {
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  // Matching and clearing in one atomic update means the same link cannot be used twice,
  // even by two requests at the same moment.
  const user = await User.findOneAndUpdate(
    { resetTokenHash: sha256(token), resetTokenExpiresAt: { $gt: new Date() }, status: 'active' },
    { $set: { passwordHash }, $unset: { resetTokenHash: 1, resetTokenExpiresAt: 1 }, $inc: { refreshTokenVersion: 1 } },
  );
  if (!user) throw ApiError.badRequest('invalid', 'This reset link is no longer valid. Request a new one.');
}

/* --------------------------------------------------------------- me */

export async function currentSession(user) {
  const business = await Business.findById(user.businessId);
  if (!business) throw ApiError.notFound('BUSINESS_NOT_FOUND', 'This business no longer exists');
  return { user, business, home: homeFor(user.role) };
}

/* ----------------------------------------------------------- signup */

// Creates the owner and their business together. If any step fails, nothing is saved.
export async function signup({ name, email, password, businessName, businessType, plan }) {
  if (await User.exists({ email })) {
    throw ApiError.conflict('EMAIL_TAKEN', 'An account with this email already exists');
  }

  // Slow work happens before the transaction, so the transaction stays short.
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  const slug = await uniqueSlug(businessName);
  const template = templateFor(businessType);

  // Ids are made up front so the documents can point at each other.
  const businessId = new ObjectId();
  const userId = new ObjectId();
  const services = template.services.map((s, i) => ({ _id: new ObjectId(), businessId, sortOrder: i, ...s }));
  const resources = template.resources.map((r) => ({
    businessId,
    name: r.name,
    serviceIds: r.services.map((index) => services[index]._id),
  }));

  let result;
  await mongoose.connection.transaction(async (session) => {
    const [business] = await Business.create(
      [
        {
          _id: businessId,
          name: businessName,
          slug,
          type: businessType,
          plan: 'free',
          isLive: false,
          intendedPlan: plan ?? null,
          ownerId: userId,
          contact: { email },
          labels: template.labels,
          settings: template.settings,
          branding: { welcomeMessage: `Welcome to ${businessName}. Join the line from your phone.`.slice(0, 120) },
        },
      ],
      { session },
    );
    await Service.insertMany(services, { session });
    await Resource.insertMany(resources, { session });
    const [user] = await User.create(
      [{ _id: userId, name, email, passwordHash, role: ROLES.OWNER, businessId, lastLoginAt: new Date(), avatarColor: '#0B1F1C' }],
      { session },
    );
    await ActivityLog.create(
      [{ businessId, actorId: userId, kind: 'settings', text: `Business created from the ${businessType} template` }],
      { session },
    );
    result = { user, business };
  });

  return result;
}
