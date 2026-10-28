import { spawnSync } from 'node:child_process';
import request from 'supertest';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import app from '../app.js';
import { Business } from '../src/models/Business.js';
import { User } from '../src/models/User.js';
import { Token } from '../src/models/Token.js';
import { StaffInvite } from '../src/models/StaffInvite.js';
import { Invoice } from '../src/models/Invoice.js';
import { seedDatabase } from '../src/seed/seed.js';
import { notificationsIdle } from '../src/services/notification.service.js';
import { dateKey } from '../src/utils/tokenNumber.js';

let mongo;
let summary;

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await mongoose.connect(mongo.getUri('queueless_seed_test'));
  summary = await seedDatabase();
});

afterAll(async () => {
  await notificationsIdle();
  await mongoose.disconnect();
  await mongo.stop();
});

const login = (email) => request(app).post('/api/auth/login').send({ email, password: 'demo1234' });

describe('npm run seed', () => {
  test('creates the four demo businesses', async () => {
    const list = await Business.find().sort({ name: 1 });
    expect(list.map((b) => [b.slug, b.plan, b.isLive])).toEqual([
      ['campus-canteen', 'pro', true],
      ['city-care', 'free', true],
      ['glow-studio', 'free', false],
      ['united-bank', 'business', true],
    ]);
    expect(summary.businesses.find((b) => b.slug === 'glow-studio').tokens).toBe(0);
  });

  test('60 to 100 tokens per live business, spread over 30 days', async () => {
    for (const slug of ['city-care', 'united-bank', 'campus-canteen']) {
      const business = await Business.findOne({ slug });
      const tokens = await Token.find({ businessId: business._id });
      expect(tokens.length).toBeGreaterThanOrEqual(60);
      expect(tokens.length).toBeLessThanOrEqual(100);
      expect(new Set(tokens.map((t) => t.day)).size).toBeGreaterThanOrEqual(29);
      expect(tokens.some((t) => t.status === 'WAITING')).toBe(true);
    }
  });

  test('every demo login works with demo1234, and secrets are hashed', async () => {
    for (const email of ['owner@demo.com', 'staff@demo.com', 'owner.bank@demo.com', 'staff.canteen@demo.com', 'owner.salon@demo.com']) {
      expect((await login(email)).status).toBe(200);
    }
    const lakshmi = await User.findOne({ email: 'lakshmi@citycare.example' });
    expect(lakshmi.passwordHash).toMatch(/^\$2b\$12\$/);
    expect(await bcrypt.compare('2345', lakshmi.pinHash)).toBe(true);
    const invite = await StaffInvite.findOne({ email: 'kavya.reddy@citycare.example' });
    expect(invite.tokenHash).toMatch(/^[a-f0-9]{64}$/);
  });

  test('the old canteen link redirects to the new one', async () => {
    const res = await request(app).get('/api/public/college-canteen');
    expect(res.status).toBe(308);
    expect(JSON.stringify(res.body) + (res.headers.location ?? '')).toContain('campus-canteen');
  });

  test('invites in every state', async () => {
    const states = (await StaffInvite.find()).map((i) => (i.status === 'pending' && i.expiresAt < new Date() ? 'expired' : i.status));
    expect(new Set(states)).toEqual(new Set(['pending', 'expired', 'revoked', 'accepted']));
    const link = (status) => summary.invites.find((i) => i.status === status && i.email.includes('kavya')).link.split('/').pop();
    expect((await request(app).get(`/api/invites/${link('pending')}`)).status).toBe(200);
    const expired = summary.invites.find((i) => i.email.startsWith('sneha')).link.split('/').pop();
    expect((await request(app).get(`/api/invites/${expired}`)).status).toBe(410);
  });

  test('invoices are in paise', async () => {
    const invoice = await Invoice.findOne({ number: 'QL-CN-2410' });
    expect(invoice).toMatchObject({ amount: 99900, status: 'paid', plan: 'Pro (monthly)' });
  });

  test('screens have data: analytics, and a new join continues today’s numbers', async () => {
    const owner = await login('owner.canteen@demo.com');
    const analytics = await request(app).get('/api/admin/analytics?range=30').set('Authorization', `Bearer ${owner.body.accessToken}`);
    expect(analytics.status).toBe(200);
    expect(analytics.body.daily.filter((d) => d.tokens > 0).length).toBeGreaterThanOrEqual(29);

    const business = await Business.findOne({ slug: 'campus-canteen' });
    const [last] = await Token.find({ businessId: business._id, day: dateKey(new Date(), business.timeZone) }).sort({ number: -1 }).limit(1);
    const join = await request(app).post('/api/public/campus-canteen/tokens').send({ customer: { name: 'New Person', phone: '9000000001' } });
    expect(join.status).toBe(201);
    expect(join.body.token.number).toBe((last?.number ?? 0) + 1); // T-012 after T-011, never a second T-001
  });

  test('refuses to run when NODE_ENV=production', () => {
    const result = spawnSync(process.execPath, ['src/seed/seed.js'], {
      env: { ...process.env, NODE_ENV: 'production', JWT_REFRESH_SECRET: 'a-different-refresh-secret-123456' },
      encoding: 'utf8',
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Refusing to seed: NODE_ENV is production');
  });
});
