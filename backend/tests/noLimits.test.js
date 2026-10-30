import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

// The app as it really runs: plans are for show only (PLAN_LIMITS=off), so a business on the
// Free plan can use every feature with no limits. The other test files switch limits on to keep
// checking the enforcement code.
process.env.PLAN_LIMITS = 'off';
const { default: app } = await import('../app.js');
const { Business } = await import('../src/models/Business.js');
const { notificationsIdle } = await import('../src/services/notification.service.js');

let mongo;

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await mongoose.connect(mongo.getUri('queueless_nolimits_test'));
  await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).syncIndexes()));
});

afterAll(async () => {
  await notificationsIdle();
  await mongoose.disconnect();
  await mongo.stop();
});

async function freeBusiness() {
  const res = await request(app).post('/api/auth/signup').send({
    name: 'Meera', email: 'free@test.example', password: 'Sunrise#2024', businessName: 'Free Clinic', businessType: 'clinic', terms: true,
  });
  await Business.updateOne({ _id: res.body.business.id }, { isLive: true, 'settings.allowPriority': true });
  return { slug: res.body.business.slug, auth: `Bearer ${res.body.accessToken}`, plan: res.body.business.plan };
}

test('a Free business can use every feature, with no limits', async () => {
  const b = await freeBusiness();
  expect(b.plan).toBe('free');
  const owner = (method, path) => request(app)[method](path).set('Authorization', b.auth);

  // Counters: Free used to allow 1 active; now as many as needed.
  const services = (await owner('get', '/api/admin/services')).body.services;
  for (const name of ['Dr. Two', 'Dr. Three', 'Dr. Four']) {
    const res = await owner('post', '/api/admin/resources').send({ name, serviceIds: [services[0].id], isActive: true });
    expect(res.status).toBe(201);
  }

  // Staff seats: Free used to allow 1; now any number of invites.
  const [doctor] = (await owner('get', '/api/admin/resources')).body.resources;
  for (const n of [1, 2, 3]) {
    expect((await owner('post', '/api/admin/invites').send({ email: `staff${n}@test.example`, role: 'staff', resourceId: doctor.id })).status).toBe(201);
  }

  // Paid-plan features: TV display, CSV export, advanced analytics, priority, hiding the credit.
  expect((await request(app).get(`/api/display/${b.slug}`)).status).toBe(200);
  expect((await owner('get', '/api/admin/customers/export.csv')).status).toBe(200);
  expect((await owner('get', '/api/admin/analytics')).body).toMatchObject({ locked: null, advanced: expect.any(Object) });
  const join = await request(app).post(`/api/public/${b.slug}/tokens`).send({ resourceId: doctor.id, customer: { name: 'Kiran Rao', phone: '9876543210', age: 30 }, priority: true });
  expect(join.status).toBe(201);
  expect(join.body.token.priority).toBe(true);

  // The Billing page shows every limit as unlimited (null).
  const billing = (await owner('get', '/api/billing')).body;
  expect(billing.plan.id).toBe('free');
  expect(Object.values(billing.usage).every((meter) => meter.limit === null)).toBe(true);
});
