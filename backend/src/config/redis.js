import { Redis } from 'ioredis';
import { env } from './env.js';

// For a TLS URL (rediss://, e.g. Upstash), send the host name during the TLS handshake (SNI).
// Hosted Redis serves many databases on one address and needs the name to pick the right
// certificate; without it Node cannot verify the certificate. Verification stays fully on.
export function tlsOptions(url) {
  const { protocol, hostname } = new URL(url);
  return protocol === 'rediss:' ? { tls: { servername: hostname } } : {};
}

// Shared client for counters, locks, and rate limits. It connects when connectRedis() runs.
// The pub/sub clients below copy these options through duplicate().
export const redis = new Redis(env.REDIS_URL, { lazyConnect: true, ...tlsOptions(env.REDIS_URL) });

// ioredis retries on its own; log errors instead of letting them crash the process.
redis.on('error', (err) => console.error(`Redis error: ${err.message}`));

export async function connectRedis() {
  try {
    // Rate limiters may have started the connection already (they load their scripts at startup).
    if (redis.status === 'wait') await redis.connect();
    await redis.ping();
  } catch (err) {
    console.error(`Redis connection failed: ${err.message}`);
    process.exit(1);
  }
  console.log(`Redis connected: ${redis.options.host}:${redis.options.port}`);
  return redis;
}

// Socket.IO's Redis adapter (Phase 10) needs its own publisher and subscriber connections,
// because a client in subscriber mode cannot run normal commands.
export function createPubSubClients() {
  const pubClient = redis.duplicate({ lazyConnect: false });
  const subClient = redis.duplicate({ lazyConnect: false });
  for (const client of [pubClient, subClient]) {
    client.on('error', (err) => console.error(`Redis pub/sub error: ${err.message}`));
  }
  return { pubClient, subClient };
}

// Used by tests and graceful shutdown in server.js.
export async function disconnectRedis(...extraClients) {
  await Promise.all([redis, ...extraClients].map((client) => client.quit().catch(() => client.disconnect())));
}
