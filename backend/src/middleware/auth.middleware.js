import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';

// Requires "Authorization: Bearer <access token>". Loads the user fresh from the database,
// so a deactivated account loses access immediately, not when its token expires.
// Sets req.user and req.businessId (always from the database, never from the request).
export async function requireAuth(req, res, next) {
  const header = req.get('authorization') ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) throw ApiError.unauthorized('UNAUTHORIZED', 'Please log in to continue');

  let payload;
  try {
    payload = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] });
  } catch (err) {
    // TOKEN_EXPIRED tells the frontend to call /api/auth/refresh and retry.
    if (err.name === 'TokenExpiredError') throw ApiError.unauthorized('TOKEN_EXPIRED', 'Your session expired. Refreshing…');
    throw ApiError.unauthorized('UNAUTHORIZED', 'Please log in to continue');
  }

  const user = await User.findById(payload.sub);
  if (!user || user.status !== 'active') throw ApiError.unauthorized('UNAUTHORIZED', 'Please log in to continue');

  req.user = user;
  req.businessId = user.businessId;
  next();
}

export default requireAuth;
