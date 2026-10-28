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
import { SlugHistory } from '../src/models/SlugHistory.js';
import { issueTokens } from '../src/services/auth.service.js';
import { todayHours, localNow } from '../src/utils/hours.js';

const MODELS = [User, Business, Service, Resource, Token, Queue, ActivityLog, SlugHistory];
let mongo;

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await mongoose.connect(mongo.getUri('queueless_public_test'));
  await Promise.all(MODELS.map((m) => m.syncIndexes()));
});

afterEach(() => Promise.all(MODELS.map((m) => m.deleteMany({}))));

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

/* ---------------------------------------------------------- helpers */

let n = 0;
async function owner(businessType = 'clinic') {
  n += 1;
  const res = await request(app).post('/api/auth/signup').send({
    name: 'Meera', email: `owner${n}@test.example`, password: 'Sunrise#2024', businessName: `Place ${n}`, businessType, terms: true,
  });
  const auth = `Bearer ${res.body.accessToken}`;
  const businessId = res.body.business.id;
  const call = (method, path, body) => request(app)[method](`/api/business${path}`).set('Authorization', auth).send(body);
  const reload = () => Business.findById(businessId);
  return { auth, businessId, slug: res.body.business.slug, call, reload };
}

// A business that has gone live through the real checklist.
async function liveOwner(businessType) {
  const o = await owner(businessType);
  await o.call('patch', '/slug', { slug: o.slug }); // "Confirm your link"
  expect((await o.call('post', '/go-live')).status).toBe(200);
  return o;
}

const publicPage = (slug) => request(app).get(`/api/public/${slug}`);
const join = (slug, body) => request(app).post(`/api/public/${slug}/tokens`).send(body);

/* -------------------------------------------- Step 12.1: go-live checklist */

describe('go-live checklist', () => {
  test('lists the four items; a new business only needs to confirm its link', async () => {
    const o = await owner();
    const res = await o.call('get', '/go-live');
    expect(res.status).toBe(200);
    expect(res.body.items.map((i) => [i.id, i.done])).toEqual([['service', true], ['resource', true], ['hours', true], ['slug', false]]);
    expect(res.body).toMatchObject({ ready: false, isLive: false });
    expect(res.body.items[3]).toMatchObject({ label: 'Confirm your public link', fix: '/admin/settings?tab=business' });
  });

  test('going live is refused until every item is done, then opens the queue', async () => {
    const o = await owner();
    const refused = await o.call('post', '/go-live');
    expect([refused.status, refused.body.error.code]).toEqual([409, 'NOT_READY']);
    expect(refused.body.error.message).toContain('confirm your public link');
    expect((await o.reload()).isLive).toBe(false);

    await o.call('patch', '/slug', { slug: o.slug });
    const res = await o.call('post', '/go-live');
    expect(res.status).toBe(200);
    expect(res.body.business).toMatchObject({ isLive: true, isOpen: true });
    expect(await ActivityLog.exists({ businessId: o.businessId, text: 'Queue went live' })).toBeTruthy();
    expect((await o.call('post', '/go-live')).status).toBe(200); // pressing it again is harmless
  });

  test('missing services, resources, or open days are reported', async () => {
    const o = await owner();
    await Service.updateMany({ businessId: o.businessId }, { isActive: false });
    await Resource.updateMany({ businessId: o.businessId }, { isActive: false });
    const closedWeek = Object.fromEntries(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((d) => [d, { open: false, from: '09:00', to: '18:00' }]));
    await o.call('patch', '/settings', { hours: closedWeek });

    const res = await o.call('get', '/go-live');
    expect(res.body.items.filter((i) => !i.done).map((i) => i.id)).toEqual(['service', 'resource', 'hours', 'slug']);
    expect(res.body.items[1].label).toBe('Add at least one doctor');
  });

  test('only the owner can go live or pause', async () => {
    const o = await owner();
    const staff = await User.create({ name: 'S', email: `s${n}@test.example`, passwordHash: 'x', role: 'staff', businessId: o.businessId });
    const auth = `Bearer ${issueTokens(staff).accessToken}`;
    expect((await request(app).post('/api/business/go-live').set('Authorization', auth)).status).toBe(403);
    expect((await request(app).patch('/api/business/open').set('Authorization', auth).send({ isOpen: false })).status).toBe(403);
  });
});

/* ----------------------------------- Step 12.2: pause and the join guard */

describe('pausing the queue', () => {
  test('before go live, joining is refused with not_live', async () => {
    const o = await owner('canteen');
    const res = await join(o.slug, { customer: { name: 'Kiran Rao', phone: '9876543210' } });
    expect([res.status, res.body.error.code]).toEqual([409, 'not_live']);
  });

  test('a paused queue refuses new customers, but people already waiting keep their status and can leave', async () => {
    const o = await liveOwner('canteen');
    const joined = (await join(o.slug, { customer: { name: 'Kiran Rao', phone: '9876543210' } })).body;

    const paused = await o.call('patch', '/open', { isOpen: false });
    expect(paused.body.business.isOpen).toBe(false);
    const refused = await join(o.slug, { customer: { name: 'Asha Nair', phone: '9876543211' } });
    expect([refused.status, refused.body.error.code]).toEqual([409, 'closed']);

    expect((await request(app).get(`/api/public/${o.slug}/tokens/${joined.token.id}`)).body.token.status).toBe('WAITING');
    const left = await request(app).post(`/api/public/${o.slug}/tokens/${joined.token.id}/leave`).send({ guestSecret: joined.guestSecret });
    expect(left.status).toBe(200);

    await o.call('patch', '/open', { isOpen: true });
    expect((await join(o.slug, { customer: { name: 'Asha Nair', phone: '9876543211' } })).status).toBe(201);
    expect(await ActivityLog.exists({ businessId: o.businessId, text: 'Queue paused (closed for now)' })).toBeTruthy();
  });

  test('isOpen must be true or false', async () => {
    const o = await liveOwner('canteen');
    expect((await o.call('patch', '/open', { isOpen: 'no' })).status).toBe(400);
  });
});

/* ------------------------------------------ Step 12.3: the join page */

describe('public join page', () => {
  test('returns what the join page needs, and nothing private', async () => {
    const o = await liveOwner('clinic');
    await Business.updateOne({ _id: o.businessId }, { 'contact.phone': '9845012345', 'contact.address': '14 Residency Road' });
    const res = await publicPage(o.slug);

    expect(res.status).toBe(200);
    expect(res.body.business).toMatchObject({ slug: o.slug, queueMode: 'per_resource', isLive: true, isOpen: true, isFull: false, acceptingCustomers: true, labels: { resource: 'Doctor' } });
    expect(res.body.branding).toMatchObject({ brandColor: '#0E9F8E', showPoweredBy: true });
    expect(res.body.customerFields.map((f) => f.key)).toEqual(['name', 'phone', 'age']);
    expect(res.body.services[0]).toMatchObject({ name: 'General consultation', avgMinutes: 12, waiting: 0 });
    expect(res.body.resources[0]).toMatchObject({ name: 'Dr. First doctor', isPaused: false, waiting: 0 });
    expect(res.body.offers).toEqual({ priority: false, anyAvailable: false });
    expect(res.body.hours.today).toEqual(expect.objectContaining({ day: expect.any(String), open: expect.any(Boolean), openNow: expect.any(Boolean) }));
    expect(Object.keys(res.body.hours.week)).toEqual(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);

    const everything = JSON.stringify(res.body);
    for (const secret of ['contact', '9845012345', 'Residency', `owner${n}@`, 'ownerId', '"plan"', 'smsUsed', 'setup', 'timeZone']) {
      expect(everything).not.toContain(secret);
    }
  });

  test('shows how many are waiting, and a wait estimate per line and overall', async () => {
    const o = await liveOwner('canteen'); // shared line, 5 minutes each, 1 counter
    for (let i = 0; i < 3; i += 1) await join(o.slug, { customer: { name: 'Kiran Rao', phone: `987650000${i}` } });
    const res = await publicPage(o.slug);
    expect(res.body.queue).toEqual({ waiting: 3, waitMinutes: 18 }); // round((3 + 0.5) × 5 ÷ 1)
    expect(res.body.services[0]).toMatchObject({ waiting: 3, waitMinutes: 18 });
    expect(res.body.resources[0]).toMatchObject({ waiting: 3, waitMinutes: 18 });
  });

  test('a full day, priority, "any available", and the branding credit follow plan and settings', async () => {
    const o = await liveOwner('salon'); // per resource, "any available" on
    await Business.updateOne({ _id: o.businessId }, { 'settings.maxTokensPerDay': 1, 'branding.hidePoweredBy': true, 'settings.allowPriority': true });
    await join(o.slug, { customer: { name: 'Kiran Rao', phone: '9876543210' }, resourceId: 'any' });

    let res = await publicPage(o.slug);
    expect(res.body.business).toMatchObject({ isFull: true, acceptingCustomers: false });
    expect(res.body.offers).toEqual({ priority: false, anyAvailable: true }); // Free: no priority queues
    expect(res.body.branding.showPoweredBy).toBe(true); // Free cannot hide the credit

    await Business.updateOne({ _id: o.businessId }, { plan: 'business' });
    res = await publicPage(o.slug);
    expect(res.body.offers.priority).toBe(true);
    expect(res.body.branding.showPoweredBy).toBe(false);
  });

  test('a business that is not live can still be looked up (the page says "not open yet")', async () => {
    const o = await owner('canteen');
    const res = await publicPage(o.slug);
    expect(res.status).toBe(200);
    expect(res.body.business).toMatchObject({ isLive: false, acceptingCustomers: false });
  });

  test('an old link redirects with 308, and unknown or reserved slugs are 404', async () => {
    const o = await liveOwner('canteen');
    await SlugHistory.create({ businessId: o.businessId, slug: 'old-name', redirectUntil: new Date(Date.now() + 86400000) });
    const moved = await publicPage('old-name').redirects(0);
    expect([moved.status, moved.headers.location]).toEqual([308, `/api/public/${o.slug}`]);
    expect((await publicPage('no-such-place')).status).toBe(404);
    expect((await publicPage('admin')).status).toBe(404);
  });
});

describe("today's hours in the business's time zone", () => {
  const week = { mon: { open: true, from: '09:00', to: '18:00' }, sun: { open: false, from: '09:00', to: '18:00' } };

  test('uses the local weekday and time, not UTC', () => {
    // 2026-10-26 is a Monday. 03:30 UTC is 09:00 in India: just opened.
    const at = new Date('2026-10-26T03:30:00Z');
    expect(localNow('Asia/Kolkata', at)).toEqual({ day: 'mon', time: '09:00' });
    expect(todayHours(week, 'Asia/Kolkata', at)).toEqual({ day: 'mon', open: true, from: '09:00', to: '18:00', openNow: true });
    expect(todayHours(week, 'Asia/Kolkata', new Date('2026-10-26T03:29:00Z')).openNow).toBe(false); // 08:59
    expect(todayHours(week, 'Asia/Kolkata', new Date('2026-10-26T12:30:00Z')).openNow).toBe(false); // 18:00 exactly: closed
  });

  test('a closed day is closed all day', () => {
    const sunday = new Date('2026-10-25T06:00:00Z'); // 11:30 on Sunday in India
    expect(todayHours(week, 'Asia/Kolkata', sunday)).toMatchObject({ day: 'sun', open: false, openNow: false });
  });
});

/* ------------------------------------------------ Step 12.4: TV display */

describe('TV display', () => {
  const display = (slug) => request(app).get(`/api/display/${slug}`);

  test('is locked with 402 PLAN_REQUIRED on plans without the TV display', async () => {
    const o = await liveOwner('canteen'); // Free
    const res = await display(o.slug);
    expect([res.status, res.body.error.code]).toEqual([402, 'PLAN_REQUIRED']);
  });

  test('shows what each counter is serving, who is next, and how many wait: codes only', async () => {
    const o = await liveOwner('canteen');
    await Business.updateOne({ _id: o.businessId }, { plan: 'pro' });
    const [counter] = await Resource.find({ businessId: o.businessId });
    const second = await Resource.create({ businessId: o.businessId, name: 'Counter 2', serviceIds: counter.serviceIds });
    for (let i = 1; i <= 5; i += 1) await join(o.slug, { customer: { name: `Customer Name ${i}`, phone: `987654321${i}` } });
    await request(app).post(`/api/staff/resources/${counter.id}/call-next`).set('Authorization', o.auth); // T-001
    await Token.updateOne({ code: 'T-005' }, { priority: true }); // jumps the line

    const res = await display(o.slug);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      business: { slug: o.slug, isLive: true, isOpen: true },
      branding: { brandColor: '#0E9F8E' },
      joinPath: `/${o.slug}`,
      resources: [
        { name: 'Counter 1', current: 'T-001', waiting: 4, isPaused: false },
        { id: second.id, name: 'Counter 2', current: null, waiting: 4 },
      ],
      next: ['T-005', 'T-002', 'T-003'],
      waiting: 4,
    });
    expect(JSON.stringify(res.body)).not.toMatch(/Customer Name|98765|customer|phone/);
  });

  test('before go live, the TV gets an empty "opening soon" view rather than an error', async () => {
    const o = await owner('canteen');
    await Business.updateOne({ _id: o.businessId }, { plan: 'pro' });
    const res = await display(o.slug);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ business: { isLive: false }, resources: [], next: [], waiting: 0 });
  });

  test('old links redirect; unknown links are 404', async () => {
    const o = await liveOwner('canteen');
    await SlugHistory.create({ businessId: o.businessId, slug: 'old-tv-link', redirectUntil: new Date(Date.now() + 86400000) });
    const moved = await display('old-tv-link').redirects(0);
    expect([moved.status, moved.headers.location]).toEqual([308, `/api/display/${o.slug}`]);
    expect((await display('nowhere-at-all')).status).toBe(404);
  });
});

/* ---------------------------------------------------- Step 12.5: QR code */

describe('QR code download', () => {
  test('downloads a PNG of the join link and ticks "Print your QR code"', async () => {
    const o = await liveOwner('canteen');
    expect((await o.reload()).setup.qrPrinted).toBe(false);

    const res = await request(app).get('/api/business/qr.png?size=256').set('Authorization', o.auth).buffer(true);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
    // Quotes are optional for simple names (Express 5 leaves them out); browsers accept both.
    expect(res.headers['content-disposition']).toMatch(new RegExp(`^attachment; filename="?${o.slug}-qr\\.png"?$`));
    expect(res.body.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    expect((await o.reload()).setup.qrPrinted).toBe(true);
  });

  test('the size is checked, and only the owner can download it', async () => {
    const o = await liveOwner('canteen');
    expect((await request(app).get('/api/business/qr.png?size=50').set('Authorization', o.auth)).status).toBe(400);
    expect((await request(app).get('/api/business/qr.png')).status).toBe(401);
  });
});
