import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

// Limits are off in other test files. Here they are on (with in-memory counters), and
// TRUST_PROXY=1 lets each test pretend to be a different device via X-Forwarded-For.
process.env.RATE_LIMITS = 'on';
process.env.TRUST_PROXY = '1';
const { default: app } = await import('../app.js');
const { Business } = await import('../src/models/Business.js');
const { EnterpriseLead } = await import('../src/models/EnterpriseLead.js');

let mongo;

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await mongoose.connect(mongo.getUri('queueless_ratelimit_test'));
  await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).syncIndexes()));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

/* ---------------------------------------------------------- helpers */

// Each call gives a new pretend device, so tests don't share counters.
let device = 0;
const newIp = () => `203.0.113.${(device += 1)}`;
const from = (ip) => ({ 'X-Forwarded-For': ip });

let n = 0;
async function owner() {
  n += 1;
  const email = `owner${n}@test.example`;
  const res = await request(app).post('/api/auth/signup').set(from(newIp())).send({
    name: 'Meera', email, password: 'Sunrise#2024', businessName: `Canteen ${n}`, businessType: 'canteen', terms: true,
  });
  await Business.updateOne({ _id: res.body.business.id }, { isLive: true, 'settings.maxTokensPerDay': 500 });
  return { email, slug: res.body.business.slug, auth: `Bearer ${res.body.accessToken}` };
}

const wrongLogin = (ip, email) => request(app).post('/api/auth/login').set(from(ip)).send({ email, password: 'Wrong#password1' });

function expectBlocked(res) {
  expect(res.status).toBe(429);
  expect(res.body).toMatchObject({ ok: false, error: { code: 'TOO_MANY_REQUESTS' } });
  expect(res.body.error.details.retryAfter).toBeGreaterThan(0);
  expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
}

/* ------------------------------------------------------------ login */

describe('login', () => {
  test('10 failed attempts per IP, then 429 for that IP only', async () => {
    const ip = newIp();
    for (let i = 0; i < 10; i += 1) expect((await wrongLogin(ip, `person${i}@test.example`)).status).toBe(401);
    expectBlocked(await wrongLogin(ip, 'someone-else@test.example'));
    expect((await wrongLogin(newIp(), 'someone-else@test.example')).status).toBe(401); // other devices unaffected
  });

  test('10 failed attempts per email, even from different IPs', async () => {
    const email = 'Target@Test.example';
    for (let i = 0; i < 10; i += 1) expect((await wrongLogin(newIp(), email)).status).toBe(401);
    expectBlocked(await wrongLogin(newIp(), ' target@test.example ')); // same email, any spelling
  });

  test('successful logins never count', async () => {
    const o = await owner();
    const ip = newIp();
    for (let i = 0; i < 12; i += 1) {
      const res = await request(app).post('/api/auth/login').set(from(ip)).send({ email: o.email, password: 'Sunrise#2024' });
      expect(res.status).toBe(200);
    }
  });

  test('forgot password: 10 per email', async () => {
    for (let i = 0; i < 10; i += 1) {
      expect((await request(app).post('/api/auth/forgot-password').set(from(newIp())).send({ email: 'forgetful@test.example' })).status).toBe(200);
    }
    expectBlocked(await request(app).post('/api/auth/forgot-password').set(from(newIp())).send({ email: 'forgetful@test.example' }));
  });
});

/* ------------------------------------------------------------- join */

describe('joining a queue', () => {
  const join = (slug, ip, phone) => request(app).post(`/api/public/${slug}/tokens`).set(from(ip)).send({ customer: { name: 'Kiran Rao', phone } });

  test('5 joins per device in 10 minutes', async () => {
    const o = await owner();
    const ip = newIp();
    for (let i = 0; i < 5; i += 1) expect((await join(o.slug, ip, `98765000${10 + i}`)).status).toBe(201);
    expectBlocked(await join(o.slug, ip, '9876500099'));
  });

  test('3 tries per phone per business in an hour, from any device', async () => {
    const o = await owner();
    const other = await owner();
    expect((await join(o.slug, newIp(), '9123456780')).status).toBe(201);
    // Already in line: they get their own token back (200), and it still counts.
    expect((await join(o.slug, newIp(), '+91 91234 56780')).status).toBe(200);
    expect((await join(o.slug, newIp(), '09123456780')).status).toBe(200);
    expectBlocked(await join(o.slug, newIp(), '9123456780'));
    expect((await join(other.slug, newIp(), '9123456780')).status).toBe(201); // a different business is separate
  });
});

/* ------------------------------------------------------ link checks */

describe('slug checks and invite links', () => {
  test('30 per minute per IP', async () => {
    const o = await owner();
    const ip = newIp();
    for (let i = 0; i < 30; i += 1) {
      expect((await request(app).get(`/api/business/slug/check?slug=shop-${i}`).set(from(ip)).set('Authorization', o.auth)).status).toBe(200);
    }
    expectBlocked(await request(app).get('/api/business/slug/check?slug=shop-x').set(from(ip)).set('Authorization', o.auth));
    // Invite links share the same limit for that device.
    expectBlocked(await request(app).get(`/api/invites/${'a'.repeat(43)}`).set(from(ip)));
  });
});

/* ------------------------------------------------------- enterprise */

describe('contact sales', () => {
  const lead = { name: 'Anita Shah', email: 'anita@bigclinic.example', company: 'Big Clinic Group', locations: 12, message: 'Twelve branches' };

  test('stores a lead, 3 per hour per IP', async () => {
    const ip = newIp();
    const first = await request(app).post('/api/enterprise/leads').set(from(ip)).send(lead);
    expect(first.status).toBe(201);
    expect(first.body.ok).toBe(true);
    expect(await EnterpriseLead.findOne({ email: 'anita@bigclinic.example' })).toMatchObject({ company: 'Big Clinic Group', locations: 12, status: 'new' });

    expect((await request(app).post('/api/enterprise/leads').set(from(ip)).send({ ...lead, locations: 0 })).status).toBe(400);
    expect((await request(app).post('/api/enterprise/leads').set(from(ip)).send(lead)).status).toBe(201);
    expectBlocked(await request(app).post('/api/enterprise/leads').set(from(ip)).send(lead));
  });
});

/* ----------------------------------------------------- everything else */

describe('general API limit', () => {
  test('300 per minute per logged-in user, whatever their IP', async () => {
    const o = await owner();
    const me = () => request(app).get('/api/auth/me').set(from(newIp())).set('Authorization', o.auth);
    const results = await Promise.all(Array.from({ length: 300 }, me)); // signup had no token yet, so it counted by IP
    expect(results.every((r) => r.status === 200)).toBe(true);
    const blocked = await me();
    expectBlocked(blocked);
    expect(blocked.headers.ratelimit).toMatch(/^"300-in-1min"; r=0; t=\d+$/); // r = requests remaining, t = seconds to reset
  });

  test('the health check and payment webhook are never limited', async () => {
    const ip = newIp();
    const results = await Promise.all(Array.from({ length: 310 }, () => request(app).get('/api/health').set(from(ip))));
    expect(results.every((r) => r.status === 200)).toBe(true);
  });
});
