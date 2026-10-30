import http from 'node:http';
import app from './app.js';
import { env } from './src/config/env.js';
import { connectDB, disconnectDB } from './src/config/db.js';
import { connectRedis, disconnectRedis, createPubSubClients } from './src/config/redis.js';
import { initSockets, closeSockets } from './src/sockets/index.js';
import { startJobs, stopJobs } from './src/jobs/index.js';
import { checkEmail } from './src/services/notification.service.js';

const SHUTDOWN_TIMEOUT_MS = 10000;

// 1. Connect to the databases, then create the HTTP server around the Express app.
await connectDB();
await connectRedis();
const server = http.createServer(app);

// 2. Socket.IO shares the same HTTP server and port. The Redis adapter's own publisher and
// subscriber connections let events reach clients on every server instance.
const { pubClient, subClient } = createPubSubClients();
initSockets(server, { pubClient, subClient });

// 3. Background jobs: no-shows, invite reminders, daily summaries, nightly cleanup.
startJobs();
checkEmail(); // prints whether real email is set up (does not block start-up)

// 4. Listen, and shut down cleanly on SIGTERM and SIGINT.
server.on('error', (err) => {
  console.error(err.code === 'EADDRINUSE' ? `Port ${env.PORT} is already in use` : `Server error: ${err.message}`);
  process.exit(1);
});

server.listen(env.PORT, () => {
  console.log(`QueueLess API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, shutting down`);

  // If something hangs, exit anyway rather than waiting forever.
  setTimeout(() => {
    console.error('Shutdown took too long, forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS).unref();

  try {
    stopJobs();
    // Stops live updates, disconnects every socket, and stops the HTTP server from accepting connections.
    const closed = closeSockets();
    server.closeIdleConnections();
    await closed;
    await disconnectRedis(pubClient, subClient);
    await disconnectDB();
    console.log('Shutdown complete');
    process.exit(0);
  } catch (err) {
    console.error(`Shutdown failed: ${err.message}`);
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
