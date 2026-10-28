import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { socketOptions } from '../config/socket.js';
import { authHandshake } from './auth.socket.js';
import { registerQueueSocket } from './queue.socket.js';
import { registerDisplaySocket } from './display.socket.js';
import { rooms } from './rooms.js';

let io = null;

// Creates the Socket.IO server on the same HTTP server (and port) as Express.
// With Redis publisher/subscriber clients, events reach clients connected to any server
// instance; without them (tests, a single server), events stay on this instance.
export function initSockets(httpServer, { pubClient, subClient } = {}) {
  io = new Server(httpServer, socketOptions);
  if (pubClient && subClient) io.adapter(createAdapter(pubClient, subClient));

  io.use(authHandshake);
  io.on('connection', (socket) => {
    registerQueueSocket(io, socket);
    registerDisplaySocket(io, socket);
  });
  return io;
}

// Services call this after a database write. Safe to call before the server starts
// (scripts, tests): it simply does nothing. Returns whether the event was sent.
export function emitTo(room, event, payload) {
  if (!io) return false;
  io.to(room).emit(event, payload);
  return true;
}

export const getIo = () => io;

// Ends a person's live connections on every server instance (for example when deactivated).
// Their screens then try to reconnect, and the handshake refuses them.
export function disconnectUser(userId) {
  if (io) io.in(rooms.user(userId)).disconnectSockets(true);
}

// A deleted business: its staff screens and TV displays are disconnected everywhere.
export function disconnectBusiness(businessId) {
  if (io) io.in([rooms.business(businessId), rooms.display(businessId)]).disconnectSockets(true);
}

// Stops sending first, then closes: a broadcast still running in the background (they are
// not awaited by requests) finds no server and does nothing, instead of publishing to a
// Redis connection that is shutting down. Also stops the HTTP server from taking connections.
export function closeSockets() {
  const current = io;
  io = null;
  return new Promise((resolve) => (current ? current.close(() => resolve()) : resolve()));
}
