import jwt from 'jsonwebtoken';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { env } from '../config/env.js';
import { redis } from '../config/redis.js';
import { ApiError } from '../utils/ApiError.js';
import { phoneRule } from '../validators/token.validator.js';

// Request limits. Counters live in Redis, so a limit holds across every server instance
// (with memory counters, each instance would allow the full amount). Behind a proxy or load
// balancer, set TRUST_PROXY=1 so req.ip is the customer's address, not the proxy's.
//
// Tests switch limits off (they log in and join far more often than any person), except the
// rate-limit test, which sets RATE_LIMITS=on and uses in-memory counters.
const ENABLED = env.NODE_ENV !== 'test' || process.env.RATE_LIMITS === 'on';
const USE_REDIS = env.NODE_ENV !== 'test';

const MINUTE = 60 * 1000;
const passThrough = (req, res, next) => next();

function limiter(name, { windowMs, limit, message, keyGenerator, skip, skipSuccessfulRequests = false }) {
  if (!ENABLED) return passThrough;
  return rateLimit({
    windowMs,
    limit,
    keyGenerator, // default: the client IP (IPv6 grouped by /56, so one user can't rotate addresses)
    skip,
    skipSuccessfulRequests,
    standardHeaders: 'draft-8', // RateLimit and RateLimit-Policy headers; Retry-After when blocked
    legacyHeaders: false,
    // If Redis is briefly unavailable, let requests through rather than locking everyone out.
    passOnStoreError: true,
    store: USE_REDIS ? new RedisStore({ sendCommand: (...args) => redis.call(...args), prefix: `rl:${name}:` }) : undefined,
    handler: (req, res, next) => {
      const retryAfter = Math.max(1, Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000));
      next(ApiError.tooManyRequests('TOO_MANY_REQUESTS', message, { retryAfter }));
    },
  });
}

/* ------------------------------------------------------------- keys */

const emailKey = (req) => String(req.body?.email ?? '').trim().toLowerCase();

// The same phone written differently ("+91 98765 43210", "09876543210") is one phone.
function phoneKey(req) {
  const phone = phoneRule.safeParse(req.body?.customer?.phone);
  return phone.success ? `${req.business._id}:${phone.data}` : '';
}

// Logged-in requests count per user (an office behind one IP is not one person); the rest per IP.
function userOrIpKey(req) {
  const [scheme, token] = (req.get('authorization') ?? '').split(' ');
  if (scheme === 'Bearer' && token) {
    try {
      return `user:${jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] }).sub}`;
    } catch {
      // invalid or expired: counted by IP, and requireAuth rejects it anyway
    }
  }
  return `ip:${ipKeyGenerator(req.ip)}`;
}

/* --------------------------------------------------------- limiters */

const LOGIN_MESSAGE = 'Too many attempts. Wait a few minutes and try again.';

// Login: only failed attempts count, so someone who types their password right is never blocked.
export const loginLimit = [
  limiter('login-ip', { windowMs: 15 * MINUTE, limit: 10, message: LOGIN_MESSAGE, skipSuccessfulRequests: true }),
  limiter('login-email', { windowMs: 15 * MINUTE, limit: 10, message: LOGIN_MESSAGE, skipSuccessfulRequests: true, keyGenerator: emailKey, skip: (req) => !emailKey(req) }),
];

// Forgot password: every request counts (each one sends an email).
export const forgotPasswordLimit = [
  limiter('forgot-ip', { windowMs: 15 * MINUTE, limit: 10, message: LOGIN_MESSAGE }),
  limiter('forgot-email', { windowMs: 15 * MINUTE, limit: 10, message: LOGIN_MESSAGE, keyGenerator: emailKey, skip: (req) => !emailKey(req) }),
];

// Joining a queue. The phone limit runs after publicBusiness, so it is per business.
export const joinIpLimit = limiter('join-ip', {
  windowMs: 10 * MINUTE, limit: 5, message: 'Too many tokens from this device. Please wait a few minutes.',
});
export const joinPhoneLimit = limiter('join-phone', {
  windowMs: 60 * MINUTE, limit: 3, message: 'This phone number has joined too many times. Please try again later.', keyGenerator: phoneKey, skip: (req) => !phoneKey(req),
});

// Invite links and slug checks: stops guessing invite links or scraping which names are taken.
export const linkCheckLimit = limiter('link-check', {
  windowMs: MINUTE, limit: 30, message: 'Too many requests. Please wait a minute.',
});

// "Contact sales" form.
export const enterpriseLeadLimit = limiter('enterprise-lead', {
  windowMs: 60 * MINUTE, limit: 3, message: 'Thanks, we already have your details. Please try again later.',
});

// Everything else under /api. The payment webhook is skipped: Stripe retries and bursts.
export const apiLimit = limiter('api', {
  windowMs: MINUTE, limit: 300, message: 'Too many requests. Slow down and try again.', keyGenerator: userOrIpKey,
  skip: (req) => req.path.startsWith('/billing/webhook') || req.path === '/health',
});
