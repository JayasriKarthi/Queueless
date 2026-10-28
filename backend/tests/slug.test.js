import express from 'express';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import app from '../app.js';
import { publicBusiness } from '../src/middleware/tenant.middleware.js';
import { errorMiddleware } from '../src/middleware/error.middleware.js';
import { User } from '../src/models/User.js';
import { Business } from '../src/models/Business.js';
import { Service } from '../src/models/Service.js';
import { Resource } from '../src/models/Resource.js';
import { ActivityLog } from '../src/models/ActivityLog.js';
import { SlugHistory } from '../src/models/SlugHistory.js';

// The real public pages (/api/public/:slug) arrive in Phase 12. Until then this stand-in
// uses the same publicBusiness middleware they will use, so redirects can be tested now.
const publicApp = express();
publicApp.get('/api/public/:slug', publicBusiness, (req, res) => res.json({ ok: true, slug: req.business.slug }));
publicApp.use(errorMiddleware);

let mongo;

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await mongoose.connect(mongo.getUri('queueless_slug_test'));
  await Promise.all([User, Business, Service, Resource, ActivityLog, SlugHistory].map((m) => m.syncIndexes()));
});

afterEach(async () => {
  await Promise.all([User, Business, Service, Resource, ActivityLog, SlugHistory].map((m) => m.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

/* ---------------------------------------------------------- helpers */

async function createOwner(email, businessName) {
  const res = await request(app).post('/api/auth/signup').send({
    name: 'Owner', email, password: 'Sunrise#2024', businessName, businessType: 'canteen', terms: true,
  });
  return { auth: `Bearer ${res.body.accessToken}`, businessId: res.body.business.id, slug: res.body.business.slug };
}

const check = (owner, slug) => request(app).get('/api/business/slug/check').query({ slug }).set('Authorization', owner.auth);
const change = (owner, body) => request(app).patch('/api/business/slug').set('Authorization', owner.auth).send(body);
const goLive = (owner) => Business.updateOne({ _id: owner.businessId }, { isLive: true }); // the go-live endpoint is Phase 12

/* ------------------------------------------------------------ tests */

describe('slug rules', () => {
  test('reserved and malformed slugs are rejected', async () => {
    const owner = await createOwner('a@test.example', 'Campus Canteen');

    for (const [slug, reason] of [
      ['admin', 'This name is reserved'],
      ['ab', 'Use at least 3 characters'],
      ['-bad-slug', 'Use lowercase letters'],
      ['bad slug!', 'Use lowercase letters'],
    ]) {
      const res = await check(owner, slug);
      expect(res.status).toBe(200);
      expect(res.body.available).toBe(false);
      expect(res.body.reason).toContain(reason);
    }

    const res = await change(owner, { slug: 'login' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_SLUG');
  });

  test('the current slug is reported as current, and confirming it sets slugConfirmed', async () => {
    const owner = await createOwner('a@test.example', 'Campus Canteen');
    expect((await check(owner, owner.slug)).body).toMatchObject({ available: true, current: true });

    const res = await change(owner, { slug: owner.slug });
    expect(res.status).toBe(200);
    expect(res.body.business.setup.slugConfirmed).toBe(true);
  });
});

describe('changing a slug', () => {
  test('before go live, the old slug simply disappears (no redirect history)', async () => {
    const owner = await createOwner('a@test.example', 'Campus Canteen');
    const res = await change(owner, { slug: 'college-canteen' });

    expect(res.status).toBe(200);
    expect(res.body.business.slug).toBe('college-canteen');
    expect(res.body.slugHistory).toEqual([]);
    expect(await SlugHistory.countDocuments()).toBe(0);
    expect((await request(publicApp).get(`/api/public/${owner.slug}`)).status).toBe(404);
  });

  test('after go live, a change needs confirmBreakingQr, and the old slug redirects with 308 for 90 days', async () => {
    const owner = await createOwner('a@test.example', 'Campus Canteen');
    await goLive(owner);

    const refused = await change(owner, { slug: 'college-canteen' });
    expect(refused.status).toBe(400);
    expect(refused.body.error.code).toBe('CONFIRM_REQUIRED');

    const res = await change(owner, { slug: 'college-canteen', confirmBreakingQr: true });
    expect(res.status).toBe(200);
    expect(res.body.slugHistory).toHaveLength(1);
    expect(res.body.slugHistory[0].slug).toBe(owner.slug);
    const days = (new Date(res.body.slugHistory[0].redirectUntil) - Date.now()) / 86400000;
    expect(days).toBeGreaterThan(89.9);
    expect(days).toBeLessThanOrEqual(90);

    const old = await request(publicApp).get(`/api/public/${owner.slug}`).redirects(0);
    expect(old.status).toBe(308);
    expect(old.body.redirectTo).toBe('college-canteen');
    expect(old.headers.location).toBe('/api/public/college-canteen');
    expect((await request(publicApp).get('/api/public/college-canteen')).status).toBe(200);
  });

  test('a business can take back its own old slug, which ends that redirect', async () => {
    const owner = await createOwner('a@test.example', 'Campus Canteen');
    await goLive(owner);
    await change(owner, { slug: 'college-canteen', confirmBreakingQr: true });

    const res = await change(owner, { slug: owner.slug, confirmBreakingQr: true });
    expect(res.status).toBe(200);
    expect(res.body.business.slug).toBe(owner.slug);
    expect(res.body.slugHistory.map((h) => h.slug)).toEqual(['college-canteen']);
  });
});

describe('slugs across businesses', () => {
  test("a slug in another business's redirect history is unavailable", async () => {
    const a = await createOwner('a@test.example', 'Campus Canteen');
    const b = await createOwner('b@test.example', 'Other Canteen');
    await goLive(a);
    await change(a, { slug: 'college-canteen', confirmBreakingQr: true });

    const checked = await check(b, a.slug);
    expect(checked.body).toMatchObject({ available: false, reason: 'Already taken by another business' });

    const res = await change(b, { slug: a.slug });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SLUG_TAKEN');
  });

  test('once the redirect expires, the slug 404s and becomes available again', async () => {
    const a = await createOwner('a@test.example', 'Campus Canteen');
    const b = await createOwner('b@test.example', 'Other Canteen');
    await goLive(a);
    await change(a, { slug: 'college-canteen', confirmBreakingQr: true });

    // MongoDB's TTL cleanup runs about once a minute; expiry is simulated by moving the date.
    await SlugHistory.updateOne({ slug: a.slug }, { redirectUntil: new Date(Date.now() - 1000) });

    expect((await request(publicApp).get(`/api/public/${a.slug}`)).status).toBe(404);
    expect((await check(b, a.slug)).body.available).toBe(true);
    const res = await change(b, { slug: a.slug });
    expect(res.status).toBe(200);
    expect(res.body.business.slug).toBe(a.slug);
  });

  test('another business cannot see or change this business through the slug routes', async () => {
    const a = await createOwner('a@test.example', 'Campus Canteen');
    const b = await createOwner('b@test.example', 'Other Canteen');
    await change(b, { slug: 'b-new-link' });
    expect((await Business.findById(a.businessId)).slug).toBe(a.slug);
  });
});
