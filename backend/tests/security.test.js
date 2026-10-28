import { spawnSync } from 'node:child_process';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import app from '../app.js';
import { User } from '../src/models/User.js';
import { Business } from '../src/models/Business.js';
import { Service } from '../src/models/Service.js';
import { Resource } from '../src/models/Resource.js';
import { Token } from '../src/models/Token.js';
import { Queue } from '../src/models/Queue.js';
import { ActivityLog } from '../src/models/ActivityLog.js';
import { StaffInvite } from '../src/models/StaffInvite.js';
import { Subscription } from '../src/models/Subscription.js';
import { Invoice } from '../src/models/Invoice.js';
import { EnterpriseLead } from '../src/models/EnterpriseLead.js';
import { outbox, notificationsIdle } from '../src/services/notification.service.js';
import { setStripeClient } from '../src/services/billing.service.js';
import { issueTokens } from '../src/services/auth.service.js';

const DATA = [Token, Queue, Service, Resource, ActivityLog, StaffInvite, Subscription]; // everything but invoices
let mongo;

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await mongoose.connect(mongo.getUri('queueless_security_test'));
  await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).syncIndexes()));
});

afterEach(async () => {
  await notificationsIdle();
  await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).deleteMany({})));
  outbox.length = 0;
  setStripeClient(null);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

/* ---------------------------------------------------------- helpers */

let n = 0;
// A live business with a token in line, a pending invite, and an activity entry.
async function busyBusiness() {
  n += 1;
  const email = `owner${n}@test.example`;
  const res = await request(app).post('/api/auth/signup').send({
    name: 'Meera', email, password: 'Sunrise#2024', businessName: `Canteen ${n}`, businessType: 'canteen', terms: true,
  });
  const { id: businessId, slug } = res.body.business;
  const auth = `Bearer ${res.body.accessToken}`;
  await Business.updateOne({ _id: businessId }, { isLive: true, plan: 'pro' });
  await request(app).post(`/api/public/${slug}/tokens`).send({ customer: { name: 'Kiran Rao', phone: '9876543210' } });
  await request(app).post('/api/admin/invites').set('Authorization', auth).send({ email: `staff${n}@test.example`, role: 'staff' });
  await notificationsIdle();
  return { businessId, slug, email, auth };
}

const remaining = (businessId) => Promise.all(DATA.map((Model) => Model.countDocuments({ businessId })));

/* ------------------------------------------------------- danger zone */

describe('DELETE /api/business', () => {
  test('needs the link typed exactly; nothing changes otherwise', async () => {
    const b = await busyBusiness();
    const res = await request(app).delete('/api/business').set('Authorization', b.auth).send({ slug: 'something-else' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: 'SLUG_MISMATCH', message: `Type ${b.slug} exactly to confirm.` });
    expect((await request(app).delete('/api/business').set('Authorization', b.auth).send({})).status).toBe(400);
    expect(await Business.exists({ _id: b.businessId })).toBeTruthy();
  });

  test('only the owner can delete', async () => {
    const b = await busyBusiness();
    const manager = await User.create({ name: 'Imran Khan', email: 'manager@test.example', passwordHash: 'x', role: 'manager', businessId: b.businessId });
    const res = await request(app).delete('/api/business').set('Authorization', `Bearer ${issueTokens(manager).accessToken}`).send({ slug: b.slug });
    expect(res.status).toBe(403);
    expect(await Business.exists({ _id: b.businessId })).toBeTruthy();
  });

  test('removes the business at once and its data in the background, leaving others alone', async () => {
    const b = await busyBusiness();
    const other = await busyBusiness();

    const res = await request(app).delete('/api/business').set('Authorization', b.auth).send({ slug: ` ${b.slug.toUpperCase()} ` });
    expect(res.status).toBe(202);
    expect(res.body.ok).toBe(true);

    // Straight away: logins, the owner's screens, and the public page stop working.
    expect((await request(app).get('/api/business').set('Authorization', b.auth)).status).toBe(401);
    expect((await request(app).post('/api/auth/login').send({ email: b.email, password: 'Sunrise#2024' })).status).toBe(401);
    expect((await request(app).get(`/api/public/${b.slug}`)).status).toBe(404);

    await notificationsIdle();
    expect(await remaining(b.businessId)).toEqual(DATA.map(() => 0));
    expect((await remaining(other.businessId)).some((count) => count > 0)).toBe(true);
    expect(await Business.exists({ _id: other.businessId })).toBeTruthy();

    // The email and the link can be used again.
    const again = await request(app).post('/api/auth/signup').send({
      name: 'Meera', email: b.email, password: 'Sunrise#2024', businessName: 'Fresh Start', businessType: 'canteen', terms: true,
    });
    expect(again.status).toBe(201);
    expect((await request(app).get(`/api/business/slug/check?slug=${b.slug}`).set('Authorization', `Bearer ${again.body.accessToken}`)).body.available).toBe(true);
  });

  test('keeps invoices for tax records, with who was billed', async () => {
    const b = await busyBusiness();
    await Business.updateOne({ _id: b.businessId }, { 'contact.email': 'accounts@canteen.example', 'contact.address': '1 Main Road, Pune' });
    await Invoice.create({ businessId: b.businessId, number: 'QL-TAX-1', date: new Date(), plan: 'Pro (monthly)', amount: 99900, status: 'paid' });

    expect((await request(app).delete('/api/business').set('Authorization', b.auth).send({ slug: b.slug })).status).toBe(202);
    await notificationsIdle();
    const invoice = await Invoice.findOne({ number: 'QL-TAX-1' });
    expect(invoice).toMatchObject({ amount: 99900, billedTo: { name: expect.stringMatching(/^Canteen \d+$/), email: 'accounts@canteen.example', address: '1 Main Road, Pune' } });
  });

  test('cancels a paid subscription first', async () => {
    const cancelled = [];
    setStripeClient({ subscriptions: { cancel: async (id) => cancelled.push(id) } });
    const b = await busyBusiness();
    await Subscription.create({ businessId: b.businessId, plan: 'pro', status: 'active', providerSubscriptionId: 'sub_test_123' });

    expect((await request(app).delete('/api/business').set('Authorization', b.auth).send({ slug: b.slug })).status).toBe(202);
    expect(cancelled).toEqual(['sub_test_123']);
  });

  test('if the subscription cannot be cancelled, nothing is deleted', async () => {
    setStripeClient({ subscriptions: { cancel: async () => { throw new Error('Stripe is down'); } } });
    const b = await busyBusiness();
    await Subscription.create({ businessId: b.businessId, plan: 'pro', status: 'active', providerSubscriptionId: 'sub_test_456' });

    const res = await request(app).delete('/api/business').set('Authorization', b.auth).send({ slug: b.slug });
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('PAYMENT_PROVIDER_ERROR');
    expect(await Business.exists({ _id: b.businessId })).toBeTruthy();
    expect(await User.exists({ email: b.email })).toBeTruthy();
  });
});

/* ---------------------------------------------------- contact sales */

describe('POST /api/enterprise/leads', () => {
  const lead = { name: 'Anita Shah', email: 'Anita@BigClinic.example', company: 'Big Clinic Group', locations: 12, message: 'Twelve branches in Pune' };

  test('saves the lead and emails the sales inbox', async () => {
    const res = await request(app).post('/api/enterprise/leads').send(lead);
    expect(res.status).toBe(201);
    expect(await EnterpriseLead.findOne({ email: 'anita@bigclinic.example' })).toMatchObject({ company: 'Big Clinic Group', locations: 12 });

    await notificationsIdle();
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({ to: 'sales@queueless.app', subject: 'Enterprise lead: Big Clinic Group (12 locations)' });
    expect(outbox[0].text).toContain('Email: anita@bigclinic.example');
    expect(outbox[0].text).toContain('Twelve branches in Pune');
  });

  test.each([
    [{ email: 'anita@gmail.com' }, 'Use your work email, not a personal one like Gmail'],
    [{ email: 'anita@Yahoo.co.in' }, 'Use your work email, not a personal one like Gmail'],
    [{ email: 'not-an-email' }, 'Enter a valid work email'],
    [{ locations: 0 }, 'At least 1 location'],
    [{ message: 'x'.repeat(1001) }, 'Keep the message under 1000 characters'],
    [{ plan: 'free' }, null], // unknown fields are refused
  ])('refuses %o', async (change, message) => {
    const res = await request(app).post('/api/enterprise/leads').send({ ...lead, ...change });
    expect(res.status).toBe(400);
    if (message) expect(JSON.stringify(res.body.error)).toContain(message);
    expect(await EnterpriseLead.countDocuments()).toBe(0);
  });
});

/* ----------------------------------------------------- payments mode */

describe('Stripe keys', () => {
  test('the server refuses to start with a live key (test mode only, for learning)', () => {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', "await import('./src/config/env.js')"], {
      env: { ...process.env, STRIPE_SECRET_KEY: 'sk_live_not_a_real_key' },
      encoding: 'utf8',
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('STRIPE_SECRET_KEY is a live key');
  });
});
