import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import * as authService from '../services/auth.service.js';

export const REFRESH_COOKIE = 'ql_refresh';

// The refresh token lives in an HTTP-only cookie that page scripts cannot read.
// It is only sent to /api/auth routes (refresh and logout).
const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/api/auth',
};

function setRefreshCookie(res, refreshToken) {
  const { exp } = jwt.decode(refreshToken);
  res.cookie(REFRESH_COOKIE, refreshToken, { ...cookieOptions, maxAge: exp * 1000 - Date.now() });
}

const clearRefreshCookie = (res) => res.clearCookie(REFRESH_COOKIE, cookieOptions);

// Sets the refresh cookie and returns the access token for the response body.
function startSession(res, user) {
  const { accessToken, refreshToken } = authService.issueTokens(user);
  setRefreshCookie(res, refreshToken);
  return accessToken;
}

// POST /api/auth/signup
export async function signup(req, res) {
  const { user, business } = await authService.signup(req.body);
  const accessToken = startSession(res, user);
  res.status(201).json({ ok: true, user, business, accessToken, home: '/onboarding/welcome' });
}

// POST /api/auth/login
export async function login(req, res) {
  const user = await authService.login(req.body);
  const accessToken = startSession(res, user);
  res.json({ ok: true, user, accessToken, home: authService.homeFor(user.role) });
}

// POST /api/auth/refresh: swap a valid refresh cookie for a new access token and a new cookie.
export async function refresh(req, res) {
  try {
    const user = await authService.refresh(req.cookies[REFRESH_COOKIE]);
    const accessToken = startSession(res, user);
    res.json({ ok: true, user, accessToken, home: authService.homeFor(user.role) });
  } catch (err) {
    clearRefreshCookie(res);
    throw err;
  }
}

// POST /api/auth/logout: always succeeds, even if the cookie was already invalid.
export async function logout(req, res) {
  await authService.logout(req.cookies[REFRESH_COOKIE]);
  clearRefreshCookie(res);
  res.json({ ok: true });
}

// POST /api/auth/forgot-password: the same answer whether or not the email has an account.
export async function forgotPassword(req, res) {
  await authService.requestPasswordReset(req.body.email);
  res.json({ ok: true, message: 'If an account exists for this email, a reset link is on its way.' });
}

// POST /api/auth/reset-password
export async function resetPassword(req, res) {
  await authService.resetPassword(req.body);
  clearRefreshCookie(res);
  res.json({ ok: true, message: 'Your password has been changed. Please log in.' });
}

// GET /api/auth/me (needs a valid access token)
export async function me(req, res) {
  const session = await authService.currentSession(req.user);
  res.json({ ok: true, ...session });
}
