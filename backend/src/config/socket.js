import { env } from './env.js';

// Socket.IO server options, kept here so sockets/index.js stays focused on events.
export const socketOptions = {
  path: '/socket.io',
  cors: { origin: env.CLIENT_URL, credentials: true },
  // Send a ping every 25 seconds; drop clients that do not answer within 20 seconds.
  pingInterval: 25000,
  pingTimeout: 20000,
  // Queue events are small, so cap incoming messages at 100 KB.
  maxHttpBufferSize: 1e5,
};
