import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/User.js';

// Refuses the connection with a code the frontend can act on (TOKEN_EXPIRED: refresh and reconnect).
const refuse = (code, message) => Object.assign(new Error(message), { data: { code } });

// Runs once per connection, before anything else. Two kinds of sockets:
//  - guests (customer phones, TV displays): no token, socket.data.user stays null;
//  - owners and staff: send { auth: { token: <access token> } } when connecting.
// A socket that sends a token must have a valid one: the user is loaded from the database,
// so deactivated accounts cannot connect. The business always comes from the user, never the client.
export async function authHandshake(socket, next) {
  socket.data.user = null;
  const token = socket.handshake.auth?.token;
  if (!token) return next();

  let payload;
  try {
    payload = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] });
  } catch (err) {
    return next(err.name === 'TokenExpiredError' ? refuse('TOKEN_EXPIRED', 'Session expired') : refuse('UNAUTHORIZED', 'Please log in again'));
  }

  try {
    const user = await User.findById(payload.sub).select('name role businessId resourceId status');
    if (!user || user.status !== 'active') return next(refuse('UNAUTHORIZED', 'Please log in again'));
    socket.data.user = {
      id: String(user._id),
      name: user.name,
      role: user.role,
      businessId: String(user.businessId),
      resourceId: user.resourceId ? String(user.resourceId) : null,
    };
    return next();
  } catch (err) {
    return next(err);
  }
}
