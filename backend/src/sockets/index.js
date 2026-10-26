import { Server } from 'socket.io';
import { socketOptions } from '../config/socket.js';

// Stub for now. Phase 10 adds the Redis adapter, the auth handshake, rooms, and queue/display events.
export function initSockets(httpServer) {
  const io = new Server(httpServer, socketOptions);
  return io;
}

