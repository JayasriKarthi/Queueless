import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { connectDB, disconnectDB } from '../config/db.js';
import { ActivityLog } from '../models/ActivityLog.js';
import { Business } from '../models/Business.js';
import { Invoice } from '../models/Invoice.js';
import { Notification } from '../models/Notification.js';
import { Queue } from '../models/Queue.js';
import { Resource } from '../models/Resource.js';
import { Service } from '../models/Service.js';
import { SlugHistory } from '../models/SlugHistory.js';
import { StaffInvite } from '../models/StaffInvite.js';
import { Subscription } from '../models/Subscription.js';
import { Token } from '../models/Token.js';
import { User } from '../models/User.js';
import '../models/EnterpriseLead.js'; // registered, so its indexes are rebuilt too
import '../models/WebhookEvent.js';
import { ACTIVE_STATUSES } from '../utils/constants.js';
import { dateKey } from '../utils/tokenNumber.js';
import { buildDemoData, DEMO_PASSWORD } from './demoData.js';

// npm run seed: wipes the development database and fills it with the demo world
// (the same businesses, people, and history as the frontend's demo mode), then exits.
// Every secret is stored the way the app stores it: bcrypt for passwords and PINs,
// SHA-256 for invite links and customers' guest secrets.

const BCRYPT_COST = 12; // the same cost the app uses
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

// Builds each document through its model (defaults and validation), then inserts it as is,
// so createdAt can be in the past (Mongoose would otherwise set it to now).
async function insert(Model, docs) {
  if (!docs.length) return;
  const raw = docs.map((data) => {
    const doc = new Model(data);
    const error = doc.validateSync();
    if (error) throw new Error(`${Model.modelName} is not valid: ${error.message}`);
    const plain = doc.toObject({ transform: false, flattenMaps: true }); // keep _id and hashes
    plain.updatedAt = plain.createdAt;
    return plain;
  });
  await Model.collection.insertMany(raw);
}

export async function seedDatabase(now = new Date()) {
  if (env.NODE_ENV === 'production') throw new Error('Refusing to seed: NODE_ENV is production, and seeding deletes every record.');
  const demo = buildDemoData(now);

  // One ObjectId per key, so records can point at each other before anything is saved.
  const ids = new Map();
  const id = (key) => {
    if (key == null) return null;
    if (!ids.has(key)) ids.set(key, new mongoose.Types.ObjectId());
    return ids.get(key);
  };

  // 1. An empty database with every index in place.
  await mongoose.connection.dropDatabase();
  await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).syncIndexes()));

  // 2. Businesses, their services and counters, and old links.
  const ownerOf = Object.fromEntries(demo.users.filter((u) => u.role === 'owner').map((u) => [u.business, u.key]));
  const smsMonth = dateKey(now, 'Asia/Kolkata').slice(0, 7);
  const byKey = Object.fromEntries(demo.businesses.map((b) => [b.key, b]));
  await insert(Business, demo.businesses.map(({ key, services, resources, oldSlugs, ...b }) => ({ ...b, _id: id(key), ownerId: id(ownerOf[key]), timeZone: 'Asia/Kolkata', smsMonth })));
  await insert(Service, demo.businesses.flatMap((b) => b.services.map((s, i) => ({
    _id: id(s.key), businessId: id(b.key), name: s.name, avgMinutes: s.avgMinutes, prefix: s.prefix, sortOrder: i, createdAt: b.createdAt,
  }))));
  await insert(Resource, demo.businesses.flatMap((b) => b.resources.map((r) => ({
    _id: id(r.key), businessId: id(b.key), name: r.name, serviceIds: r.services.map(id), createdAt: b.createdAt,
  }))));
  await insert(SlugHistory, demo.businesses.flatMap((b) => (b.oldSlugs ?? []).map((s) => ({ businessId: id(b.key), ...s, createdAt: now }))));

  // 3. People. Hashing is slow on purpose, so it runs in parallel.
  await insert(User, await Promise.all(demo.users.map(async (u) => ({
    _id: id(u.key), name: u.name, email: u.email, role: u.role, businessId: id(u.business), resourceId: id(u.resource),
    passwordHash: await bcrypt.hash(DEMO_PASSWORD, BCRYPT_COST), pinHash: await bcrypt.hash(u.pin, BCRYPT_COST),
    lastLoginAt: u.lastLoginAt, avatarColor: u.avatarColor, createdAt: u.createdAt,
  }))));
  await insert(StaffInvite, demo.invites.map((inv) => ({
    businessId: id(inv.business), email: inv.email, role: inv.role, resourceId: id(inv.resource), tokenHash: sha256(inv.token),
    status: inv.status, expiresAt: inv.expiresAt, invitedBy: id(inv.invitedBy), acceptedAt: inv.acceptedAt, revokedAt: inv.revokedAt,
    userId: id(inv.user), createdAt: inv.createdAt,
  })));

  // 4. Billing, the activity feed, and the bell.
  await insert(Subscription, demo.subscriptions.map((s) => ({ ...s, businessId: id(s.business), provider: 'stripe', createdAt: byKey[s.business].createdAt })));
  await insert(Invoice, demo.invoices.map((inv) => ({ ...inv, businessId: id(inv.business), createdAt: inv.date })));
  await insert(ActivityLog, demo.activity.map((a) => ({ ...a, businessId: id(a.business) })));
  await insert(Notification, demo.notifications.map((n) => ({ ...n, businessId: id(n.business) })));

  // 5. Tokens, and each day's number counters so new joins today continue the sequence.
  const queueKey = (q) => (q.type === 'shared' ? 'shared' : `${q.type}:${id(q.key)}`);
  await insert(Token, demo.tokens.map((t) => ({
    businessId: id(t.business), queueKey: queueKey(t.queue), number: t.number, code: t.code, day: t.day,
    ...(ACTIVE_STATUSES.includes(t.status) && { activePhone: t.customer.phone }),
    serviceId: id(t.service), resourceId: id(t.resource), customer: t.customer, priority: t.priority, status: t.status, source: t.source,
    calledAt: t.calledAt, servedAt: t.servedAt, doneAt: t.doneAt, cancelledAt: t.cancelledAt, cancelledBy: t.cancelledBy, rating: t.rating,
    sortAt: t.createdAt, guestSecretHash: sha256(crypto.randomBytes(24).toString('base64url')), createdAt: t.createdAt,
  })));
  const counters = new Map(); // "business|day" → { A: 12, total: 20 }
  for (const t of demo.tokens) {
    const k = `${t.business}|${t.day}`;
    const c = counters.get(k) ?? { total: 0 };
    c[t.prefix] = Math.max(c[t.prefix] ?? 0, t.number);
    c.total += 1;
    counters.set(k, c);
  }
  await insert(Queue, [...counters].map(([k, c]) => {
    const [business, date] = k.split('|');
    return { businessId: id(business), queueKey: 'all', date, counters: c, createdAt: now };
  }));

  return {
    businesses: demo.businesses.map((b) => ({ name: b.name, slug: b.slug, plan: b.plan, isLive: b.isLive, tokens: demo.tokens.filter((t) => t.business === b.key).length })),
    users: demo.users.map((u) => ({ email: u.email, role: u.role, business: byKey[u.business].name, pin: u.pin })),
    invites: demo.invites.map((inv) => ({ email: inv.email, status: inv.status, link: `${env.CLIENT_URL}/accept-invite/${inv.token}` })),
  };
}

/* --------------------------------------------------------- npm run seed */

async function main() {
  if (env.NODE_ENV === 'production') {
    console.error('Refusing to seed: NODE_ENV is production, and seeding deletes every record in the database.');
    process.exit(1);
  }
  await connectDB();
  console.log(`Clearing ${mongoose.connection.name} and adding demo data...`);
  const summary = await seedDatabase();

  console.log('\nBusinesses');
  console.table(summary.businesses);
  console.log(`Logins (password for everyone: ${DEMO_PASSWORD}; the PIN is for "Switch user")`);
  console.table(summary.users);
  console.log('Staff invite links');
  console.table(summary.invites);
  await disconnectDB();
}

// Runs only as a script (npm run seed), not when a test imports seedDatabase.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(async (err) => {
    console.error('Seeding failed:', err);
    await disconnectDB();
    process.exit(1);
  });
}
