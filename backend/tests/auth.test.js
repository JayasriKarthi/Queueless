import express from 'express';
import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import app from '../app.js';
import { env } from '../src/config/env.js';
import { User } from '../src/models/User.js';
import { Business } from '../src/models/Business.js';
import { Service } from '../src/models/Service.js';
import { Resource } from '../src/models/Resource.js';
import { ActivityLog } from '../src/models/ActivityLog.js';
import { outbox } from '../src/services/notification.service.js';
import { requireAuth } from '../src/middleware/auth.middleware.js';
import { requireRole } from '../src/middleware/role.middleware.js';
import { errorMiddleware } from '../src/middleware/error.middleware.js';

// A single-node replica set, because signup uses a transaction.
let mongo;

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await mongoose.connect(mongo.getUri('queueless_test'));
  await Promise.all([User, Business, Service, Resource, ActivityLog].map((m) => m.syncIndexes()));
});

afterEach(async () => {
  await Promise.all([User, Business, Service, Resource, ActivityLog].map((m) => m.deleteMany({})));
  outbox.length = 0;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

/* ---------------------------------------------------------- helpers */

const PASSWORD = 'Sunrise#2024';

const owner = (overrides = {}) => ({
  name: 'Meera Krishnan',
  email: 'owner@test.example',
  password: PASSWORD,
  businessName: 'City Care Clinic',
  businessType: 'clinic',
  terms: true,
  ...overrides,
});

const signup = (overrides) => request(app).post('/api/auth/signup').send(owner(overrides));
const login = (email, password = PASSWORD) => request(app).post('/api/auth/login').send({ email, password });
const refreshCookie = (res) => res.headers['set-cookie']?.find((c) => c.startsWith('ql_refresh='))?.split(';')[0];

/* ----------------------------------------------------------- signup */

describe('POST /api/auth/signup', () => {
  test('creates the owner and the business with the template', async () => {
    const res = await signup({ plan: 'pro' });

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: 'owner@test.example', role: 'owner' });
    expect(res.body.business).toMatchObject({ slug: 'city-care-clinic', plan: 'free', isLive: false, intendedPlan: 'pro' });
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(refreshCookie(res)).toBeDefined();
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash/);

    const businessId = res.body.business.id;
    expect(await Service.countDocuments({ businessId })).toBe(1);
    expect(await Resource.countDocuments({ businessId })).toBe(1);
    expect(await ActivityLog.countDocuments({ businessId })).toBe(1);
  });

  test('gives each business a unique slug', async () => {
    await signup();
    const second = await signup({ email: 'second@test.example' });
    expect(second.body.business.slug).toBe('city-care-clinic-2');
  });

  test('returns 409 for an email that already has an account', async () => {
    await signup();
    const res = await signup({ email: 'OWNER@test.example', businessName: 'Another Clinic' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
    expect(await Business.countDocuments()).toBe(1);
  });

  test('returns 400 with a message for each invalid field', async () => {
    const res = await request(app).post('/api/auth/signup').send({ email: 'nope', terms: false });
    expect(res.status).toBe(400);
    const fields = res.body.error.details.map((d) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['name', 'email', 'password', 'businessName', 'businessType', 'terms']));
  });
});

/* ------------------------------------------------------------ login */

describe('POST /api/auth/login', () => {
  beforeEach(() => signup());

  test('logs an owner in and sends them to /admin', async () => {
    const res = await login('  Owner@Test.example');
    expect(res.status).toBe(200);
    expect(res.body.home).toBe('/admin');
    expect(refreshCookie(res)).toBeDefined();
  });

  test('returns 401 for a wrong password, with the same message as an unknown email', async () => {
    const wrong = await login('owner@test.example', 'wrong-password');
    const unknown = await login('nobody@test.example');
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error).toEqual(unknown.body.error);
  });

  test('refuses a deactivated user', async () => {
    await User.updateOne({ email: 'owner@test.example' }, { status: 'deactivated' });
    const res = await login('owner@test.example');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_DEACTIVATED');
  });
});

/* ----------------------------------------------- access and refresh */

describe('tokens', () => {
  let session;
  beforeEach(async () => {
    session = await signup();
  });

  test('GET /me works with a valid access token', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${session.body.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.business.slug).toBe('city-care-clinic');
  });

  test('an expired access token returns 401 TOKEN_EXPIRED', async () => {
    const { sub, businessId, role } = jwt.decode(session.body.accessToken);
    const expired = jwt.sign({ businessId, role }, env.JWT_ACCESS_SECRET, { subject: sub, expiresIn: -10 });
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  test('refresh issues a new access token and a new cookie', async () => {
    const res = await request(app).post('/api/auth/refresh').set('Cookie', refreshCookie(session));
    expect(res.status).toBe(200);
    expect(refreshCookie(res)).toBeDefined();
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${res.body.accessToken}`);
    expect(me.status).toBe(200);
  });

  test('logout makes the refresh token stop working', async () => {
    const cookie = refreshCookie(session);
    const out = await request(app).post('/api/auth/logout').set('Cookie', cookie);
    expect(out.status).toBe(200);
    const res = await request(app).post('/api/auth/refresh').set('Cookie', cookie);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('SESSION_EXPIRED');
  });
});

/* ------------------------------------------------------------ roles */

describe('requireRole', () => {
  // A tiny app with one owner-only and one staff-only route.
  const roleApp = express();
  roleApp.get('/owner-only', requireAuth, requireRole('owner'), (req, res) => res.json({ ok: true }));
  roleApp.get('/staff-only', requireAuth, requireRole('staff', 'manager'), (req, res) => res.json({ ok: true }));
  roleApp.use(errorMiddleware);

  test('allows the right role and refuses others with 403', async () => {
    const { body } = await signup();
    const auth = `Bearer ${body.accessToken}`;
    expect((await request(roleApp).get('/owner-only').set('Authorization', auth)).status).toBe(200);
    const staffOnly = await request(roleApp).get('/staff-only').set('Authorization', auth);
    expect(staffOnly.status).toBe(403);
    expect(staffOnly.body.error.code).toBe('FORBIDDEN');
  });

  test('refuses requests without a token with 401', async () => {
    expect((await request(roleApp).get('/owner-only')).status).toBe(401);
  });
});

/* -------------------------------------------------- forgot password */

describe('forgot and reset password', () => {
  const tokenFromEmail = () => outbox.at(-1).text.match(/reset-password\/(\S+)/)[1];

  test('gives the same answer for known and unknown emails, and only emails real accounts', async () => {
    await signup();
    const known = await request(app).post('/api/auth/forgot-password').send({ email: 'owner@test.example' });
    const unknown = await request(app).post('/api/auth/forgot-password').send({ email: 'nobody@test.example' });
    expect(known.status).toBe(200);
    expect(unknown.body).toEqual(known.body);
    expect(outbox).toHaveLength(1);
    expect(outbox[0].to).toBe('owner@test.example');
  });

  test('the link sets a new password, works once, and logs out other sessions', async () => {
    const session = await signup();
    await request(app).post('/api/auth/forgot-password').send({ email: 'owner@test.example' });
    const token = tokenFromEmail();

    const reset = await request(app).post('/api/auth/reset-password').send({ token, password: 'New-Password-1' });
    expect(reset.status).toBe(200);
    expect((await login('owner@test.example', 'New-Password-1')).status).toBe(200);
    expect((await login('owner@test.example', PASSWORD)).status).toBe(401);

    const again = await request(app).post('/api/auth/reset-password').send({ token, password: 'Another-Password-2' });
    expect(again.status).toBe(400);
    expect(again.body.error.code).toBe('invalid');

    const oldRefresh = await request(app).post('/api/auth/refresh').set('Cookie', refreshCookie(session));
    expect(oldRefresh.status).toBe(401);
  });

  test('an expired link does not work', async () => {
    await signup();
    await request(app).post('/api/auth/forgot-password').send({ email: 'owner@test.example' });
    await User.updateOne({ email: 'owner@test.example' }, { resetTokenExpiresAt: new Date(Date.now() - 1000) });
    const res = await request(app).post('/api/auth/reset-password').send({ token: tokenFromEmail(), password: 'New-Password-1' });
    expect(res.status).toBe(400);
  });
});
