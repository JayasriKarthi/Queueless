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
import { analyticsReport } from '../src/services/analytics.service.js';
import { csvCell } from '../src/services/customers.service.js';

const MODELS = [User, Business, Service, Resource, Token, Queue, ActivityLog];
let mongo;

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await mongoose.connect(mongo.getUri('queueless_analytics_test'));
  await Promise.all(MODELS.map((m) => m.syncIndexes()));
});

afterEach(async () => {
  await Promise.all(MODELS.map((m) => m.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

/* ---------------------------------------------------------- helpers */

let n = 0;
async function owner(plan = 'business') {
  n += 1;
  const res = await request(app).post('/api/auth/signup').send({
    name: 'Meera', email: `owner${n}@test.example`, password: 'Sunrise#2024', businessName: `Clinic ${n}`, businessType: 'canteen', terms: true,
  });
  const businessId = res.body.business.id;
  await Business.updateOne({ _id: businessId }, { plan, isLive: true });
  const [counter] = await Resource.find({ businessId });
  const [tea, meals] = await Service.create([
    { businessId, name: 'Tea', avgMinutes: 5, prefix: 'T' },
    { businessId, name: 'Meals', avgMinutes: 10, prefix: 'M' },
  ]);
  return { businessId, auth: `Bearer ${res.body.accessToken}`, counter, tea, meals, business: () => Business.findById(businessId) };
}

// India time ("2026-10-28 09:10") → Date.
const ist = (text) => new Date(`${text.replace(' ', 'T')}:00+05:30`);

// Stores a finished history row exactly as given (createdAt included), skipping the join flow.
let seq = 0;
async function seed(businessId, { day, created, called, served, done, status = 'DONE', service, resource = null, name = 'Kiran Rao', phone, rating = null }) {
  seq += 1;
  const token = new Token({
    businessId, queueKey: 'all', number: seq, code: `T-${String(seq).padStart(3, '0')}`, day,
    serviceId: service._id, resourceId: resource?._id ?? null,
    customer: { name, phone: phone ?? String(9100000000 + seq) },
    status, guestSecretHash: 'x', rating,
    calledAt: called ? ist(called) : null, servedAt: served ? ist(served) : null, doneAt: done ? ist(done) : null,
  });
  const doc = token.toObject({ transform: false });
  doc.createdAt = created instanceof Date ? created : ist(created);
  doc.updatedAt = doc.createdAt;
  await Token.collection.insertOne(doc);
  return doc;
}

/* -------------------------------------------------------- analytics */

describe('analytics', () => {
  const NOW = ist('2026-10-28 12:00');

  // The hand count. Today (28th), before noon:
  //   A  09:00 → called 09:10, served 09:10–09:20 (Tea, counter)   wait 10
  //   B  09:30 → called 09:50, no-show at 09:55  (Meals, counter)  wait 20
  //   C  10:15 → still waiting                    (Meals)
  // Yesterday (27th):
  //   D  08:00 → called 08:30, served 08:30–08:40 (Tea, counter)   wait 30
  //   E  11:00 → called 11:06, served 11:06–11:20 (Tea, counter)   wait 6
  //   F  15:00 → called 15:10, served 15:10–15:20 (Tea, counter)   wait 10  ← after 12:00
  async function seedDays(c) {
    await seed(c.businessId, { day: '2026-10-28', created: '2026-10-28 09:00', called: '2026-10-28 09:10', served: '2026-10-28 09:10', done: '2026-10-28 09:20', service: c.tea, resource: c.counter, rating: 5 });
    await seed(c.businessId, { day: '2026-10-28', created: '2026-10-28 09:30', called: '2026-10-28 09:50', done: '2026-10-28 09:55', status: 'NO_SHOW', service: c.meals, resource: c.counter });
    await seed(c.businessId, { day: '2026-10-28', created: '2026-10-28 10:15', status: 'WAITING', service: c.meals });
    await seed(c.businessId, { day: '2026-10-27', created: '2026-10-27 08:00', called: '2026-10-27 08:30', served: '2026-10-27 08:30', done: '2026-10-27 08:40', service: c.tea, resource: c.counter, rating: 4 });
    await seed(c.businessId, { day: '2026-10-27', created: '2026-10-27 11:00', called: '2026-10-27 11:06', served: '2026-10-27 11:06', done: '2026-10-27 11:20', service: c.tea, resource: c.counter });
    await seed(c.businessId, { day: '2026-10-27', created: '2026-10-27 15:00', called: '2026-10-27 15:10', served: '2026-10-27 15:10', done: '2026-10-27 15:20', service: c.tea, resource: c.counter });
  }

  test('matches a hand count on seeded data', async () => {
    const c = await owner('business');
    await seedDays(c);
    // Another business's busy day must not leak in.
    const other = await owner('business');
    await seed(other.businessId, { day: '2026-10-28', created: '2026-10-28 09:00', service: other.tea });

    const report = await analyticsReport(await c.business(), 7, NOW);

    // Today vs yesterday up to 12:00 (D and E only).
    expect(report.today).toEqual({
      issued: { value: 3, yesterday: 2, change: 50 },
      served: { value: 1, yesterday: 2, change: -50 },
      avgWaitMinutes: { value: 15, yesterday: 18, change: -17 },
      noShows: { value: 1, yesterday: 0, change: null }, // no "% change" from zero
    });

    expect(report.range).toEqual({ days: 7, from: '2026-10-22', to: '2026-10-28', timeZone: 'Asia/Kolkata' });
    expect(report.daily).toHaveLength(7);
    expect(report.daily.at(-2)).toEqual({ date: '2026-10-27', tokens: 3, served: 3 });
    expect(report.daily.at(-1)).toEqual({ date: '2026-10-28', tokens: 3, served: 1 });
    expect(report.daily.slice(0, 5).every((d) => d.tokens === 0)).toBe(true);

    // Hours are India hours: 08, 09 (A, B), 10, 11, 15.
    const busy = report.customersPerHour.filter((h) => h.customers).map((h) => [h.hour, h.customers]);
    expect(busy).toEqual([[8, 1], [9, 2], [10, 1], [11, 1], [15, 1]]);
    expect(report.customersPerHour[9].perDay).toBe(0.3); // 2 over 7 days

    expect(report.serviceSplit).toEqual([
      { serviceId: c.tea.id, name: 'Tea', tokens: 4, share: 67 },
      { serviceId: c.meals.id, name: 'Meals', tokens: 2, share: 33 },
    ]);

    const [perf] = report.advanced.resourcePerformance;
    expect(perf).toMatchObject({
      resourceId: c.counter.id, served: 4, noShows: 1,
      avgWaitMinutes: 15, // (10 + 20 + 30 + 6 + 10) / 5 = 15.2
      avgServiceMinutes: 11, // (10 + 10 + 14 + 10) / 4
      rating: 4.5, ratings: 2,
    });
    expect(report.advanced.noShowTrend.at(-1)).toEqual({ date: '2026-10-28', noShows: 1, rate: 33 });
    expect(report.advanced.dailyWait.at(-1)).toEqual({ date: '2026-10-28', avgWaitMinutes: 15 });
    expect(report.locked).toBeNull();
  });

  test('advanced charts are locked below the Business plan', async () => {
    const c = await owner('pro');
    await seedDays(c);
    const report = await analyticsReport(await c.business(), 14, NOW);
    expect(report.advanced).toBeNull();
    expect(report.locked).toEqual({ feature: 'advancedAnalytics', requiredPlan: 'business' });
    expect(report.today.issued.value).toBe(3); // the basics still work
  });

  test('GET /api/admin/analytics validates the range', async () => {
    const c = await owner('free');
    const ok = await request(app).get('/api/admin/analytics?range=30').set('Authorization', c.auth);
    expect(ok.status).toBe(200);
    expect(ok.body.ok).toBe(true);
    expect(ok.body.daily).toHaveLength(30);
    expect(ok.body.today.issued.value).toBe(0);

    const bad = await request(app).get('/api/admin/analytics?range=9').set('Authorization', c.auth);
    expect(bad.status).toBe(400);
  });
});

/* -------------------------------------------------------- customers */

describe('customers', () => {
  const minutesAgo = (m) => new Date(Date.now() - m * 60000);

  test('lists newest first, with search, filters and pages', async () => {
    const c = await owner('pro');
    await seed(c.businessId, { day: '2026-10-28', created: minutesAgo(30), status: 'DONE', service: c.tea, name: 'Asha Nair', phone: '9876500001' });
    await seed(c.businessId, { day: '2026-10-28', created: minutesAgo(20), status: 'NO_SHOW', service: c.meals, name: 'Ravi Kumar', phone: '9876500002' });
    await seed(c.businessId, { day: '2026-10-28', created: minutesAgo(10), status: 'WAITING', service: c.meals, name: 'Asha Menon', phone: '9123400003' });
    await seed(c.businessId, { day: '2026-10-28', created: new Date(Date.now() - 40 * 86400000), service: c.tea, name: 'Old Visit' });
    const other = await owner('pro');
    await seed(other.businessId, { day: '2026-10-28', created: minutesAgo(5), service: other.tea, name: 'Asha Elsewhere' });

    const get = (qs) => request(app).get(`/api/admin/customers${qs}`).set('Authorization', c.auth);

    const all = await get('');
    expect(all.status).toBe(200);
    expect(all.body.items.map((t) => t.customer.name)).toEqual(['Asha Menon', 'Ravi Kumar', 'Asha Nair']); // last 30 days
    expect(all.body).toMatchObject({ page: 1, pageSize: 25, total: 3, pages: 1 });
    expect(all.body.items[1]).toMatchObject({ serviceName: 'Meals', status: 'NO_SHOW' });

    expect((await get('?q=asha')).body.items.map((t) => t.customer.name)).toEqual(['Asha Menon', 'Asha Nair']);
    expect((await get('?q=98765')).body.total).toBe(2); // by phone
    expect((await get('?status=NO_SHOW')).body.items[0].customer.name).toBe('Ravi Kumar');
    expect((await get(`?serviceId=${c.tea.id}`)).body.total).toBe(1);
    expect((await get('?days=90')).body.total).toBe(4);
    expect((await get('?q=.*')).body.total).toBe(0); // search text is not a regex

    const page2 = await get('?pageSize=10&page=2');
    expect(page2.body).toMatchObject({ items: [], page: 2, total: 3 });
    expect((await get('?pageSize=500')).status).toBe(400);
  });

  test('CSV export needs the Business plan', async () => {
    const c = await owner('pro');
    const res = await request(app).get('/api/admin/customers/export.csv').set('Authorization', c.auth);
    expect(res.status).toBe(402);
    expect(res.body.error).toMatchObject({ code: 'PLAN_REQUIRED', details: { feature: 'csvExport', requiredPlan: 'business' } });
  });

  test('CSV export streams every row, with formulas defused', async () => {
    const c = await owner('business');
    await seed(c.businessId, { day: '2026-10-28', created: minutesAgo(10), status: 'DONE', service: c.tea, resource: c.counter, name: '=HYPERLINK("http://evil")' });
    await seed(c.businessId, { day: '2026-10-28', created: minutesAgo(5), status: 'WAITING', service: c.meals, name: 'Ravi, Jr.' });

    const res = await request(app).get('/api/admin/customers/export.csv').set('Authorization', c.auth).buffer(true).parse((r, done) => {
      let text = '';
      r.setEncoding('utf8');
      r.on('data', (chunk) => { text += chunk; });
      r.on('end', () => done(null, text));
    });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="?clinic-\d+-customers-\d{4}-\d{2}-\d{2}\.csv"?/);

    const lines = res.body.replace(/^﻿/, '').trim().split('\r\n');
    expect(lines[0]).toMatch(/^Token,Name,Phone,.*Service,Counter,Status/);
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('"Ravi, Jr."');
    expect(lines[2]).toContain(`"'=HYPERLINK(""http://evil"")"`);
  });

  test('csvCell quotes and defuses', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('+91 98765')).toBe("'+91 98765");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell(12)).toBe('12');
  });
});

/* --------------------------------------------------------- activity */

describe('activity feed', () => {
  test('newest first, only this business, with a limit', async () => {
    const c = await owner('pro');
    const other = await owner('pro');
    await request(app).post('/api/admin/services').set('Authorization', c.auth).send({ name: 'Snacks', avgMinutes: 3, prefix: 'S' });
    await request(app).post('/api/admin/services').set('Authorization', other.auth).send({ name: 'Elsewhere', avgMinutes: 3, prefix: 'E' });

    const res = await request(app).get('/api/admin/activity').set('Authorization', c.auth);
    expect(res.status).toBe(200);
    expect(res.body.activity[0]).toMatchObject({ kind: 'settings', text: 'Added service "Snacks"' });
    expect(res.body.activity.every((a) => !a.text.includes('Elsewhere'))).toBe(true);
    expect(Object.keys(res.body.activity[0]).sort()).toEqual(['createdAt', 'id', 'kind', 'text']);

    const one = await request(app).get('/api/admin/activity?limit=1').set('Authorization', c.auth);
    expect(one.body.activity).toHaveLength(1);
    expect((await request(app).get('/api/admin/activity?limit=500').set('Authorization', c.auth)).status).toBe(400);
  });
});
