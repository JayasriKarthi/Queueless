import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import app from '../app.js';
import { Queue } from '../src/models/Queue.js';
import { Token } from '../src/models/Token.js';
import { User } from '../src/models/User.js';
import { Business } from '../src/models/Business.js';
import { Service } from '../src/models/Service.js';
import { Resource } from '../src/models/Resource.js';
import { ActivityLog } from '../src/models/ActivityLog.js';
import { nextTokenNumber, dateKey, formatCode } from '../src/utils/tokenNumber.js';
import { hashSecret, dailyLimit } from '../src/services/token.service.js';

const MODELS = [Queue, Token, User, Business, Service, Resource, ActivityLog];
let mongo;

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await mongoose.connect(mongo.getUri('queueless_token_test'));
  await Promise.all(MODELS.map((m) => m.syncIndexes()));
});

afterEach(() => Promise.all(MODELS.map((m) => m.deleteMany({}))));

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

const businessId = () => new mongoose.Types.ObjectId();

/* --------------------------------------------- Step 9.2: numbering */

describe('token numbers', () => {
  test('codes are padded to three digits', () => {
    expect(formatCode('A', 7)).toBe('A-007');
    expect(formatCode('T', 1234)).toBe('T-1234');
  });

  test('numbers increase per prefix, and each prefix has its own sequence', async () => {
    const id = businessId();
    const codes = [];
    for (const prefix of ['A', 'A', 'B', 'A', 'B']) codes.push((await nextTokenNumber({ businessId: id, prefix })).code);
    expect(codes).toEqual(['A-001', 'A-002', 'B-001', 'A-003', 'B-002']);
  });

  test('each business has its own numbers', async () => {
    const [a, b] = [businessId(), businessId()];
    await nextTokenNumber({ businessId: a, prefix: 'A' });
    expect((await nextTokenNumber({ businessId: b, prefix: 'A' })).code).toBe('A-001');
  });

  test('numbers restart each day', async () => {
    const id = businessId();
    const monday = new Date('2026-10-26T10:00:00+05:30');
    const tuesday = new Date('2026-10-27T10:00:00+05:30');
    await nextTokenNumber({ businessId: id, prefix: 'A', now: monday });
    await nextTokenNumber({ businessId: id, prefix: 'A', now: monday });
    expect((await nextTokenNumber({ businessId: id, prefix: 'A', now: tuesday })).code).toBe('A-001');
  });

  test("'today' follows the business's time zone, not UTC", () => {
    // 00:30 in India on 27 Oct is still 26 Oct in UTC.
    const justAfterMidnightInIndia = new Date('2026-10-26T19:00:00Z');
    expect(dateKey(justAfterMidnightInIndia, 'Asia/Kolkata')).toBe('2026-10-27');
    expect(dateKey(justAfterMidnightInIndia, 'UTC')).toBe('2026-10-26');
  });

  test('20 joins at the same time get 20 different numbers', async () => {
    const id = businessId();
    const results = await Promise.all(Array.from({ length: 20 }, () => nextTokenNumber({ businessId: id, prefix: 'A' })));
    const numbers = results.map((r) => r.number).sort((x, y) => x - y);
    expect(numbers).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });

  test('a number taken inside a failed transaction is not used up', async () => {
    const id = businessId();
    await nextTokenNumber({ businessId: id, prefix: 'A' }); // A-001
    await expect(
      mongoose.connection.transaction(async (session) => {
        await nextTokenNumber({ businessId: id, prefix: 'A', session }); // would be A-002
        throw new Error('saving the token failed');
      }),
    ).rejects.toThrow('saving the token failed');
    expect((await nextTokenNumber({ businessId: id, prefix: 'A' })).code).toBe('A-002');
  });
});

/* --------------------------------------------- Step 9.3: joining */

// A live business from a template: canteen = one shared line (prefix T),
// clinic = one line per doctor with a required "age" field, bank = one line per service.
let ownerCount = 0;
async function liveBusiness(businessType, extra = {}) {
  ownerCount += 1;
  const res = await request(app).post('/api/auth/signup').send({
    name: 'Owner', email: `owner${ownerCount}@test.example`, password: 'Sunrise#2024',
    businessName: `${businessType} ${ownerCount}`, businessType, terms: true,
  });
  const business = await Business.findByIdAndUpdate(res.body.business.id, { isLive: true, ...extra }, { returnDocument: 'after' });
  return business;
}

const join = (slug, body) => request(app).post(`/api/public/${slug}/tokens`).send(body);
let phoneSeq = 0;
const newPhone = () => `98${String(10000000 + (phoneSeq += 1)).slice(-8)}`;
const customer = (extra = {}) => ({ name: 'Kiran Rao', phone: newPhone(), ...extra });

describe('joining a queue', () => {
  test('creates a token, returns its secret once, and stores only the hash', async () => {
    const canteen = await liveBusiness('canteen');
    const res = await join(canteen.slug, { customer: customer() });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ ok: true, existing: false, ahead: 0, token: { code: 'T-001', status: 'WAITING', queueKey: 'shared' } });
    expect(res.body.guestSecret).toEqual(expect.any(String));
    expect(JSON.stringify(res.body)).not.toMatch(/Kiran|guestSecretHash|activePhone/);

    const saved = await Token.findById(res.body.token.id);
    expect(saved.guestSecretHash).toBe(hashSecret(res.body.guestSecret));
    expect(saved.day).toBe(dateKey(new Date(), 'Asia/Kolkata'));
    expect((await Business.findById(canteen._id)).setup.testTokenRun).toBe(true);

    const second = await join(canteen.slug, { customer: customer() });
    expect(second.body.token.code).toBe('T-002');
    expect(second.body.ahead).toBe(1);
  });

  test('a phone with an active token gets that token back instead of a duplicate', async () => {
    const canteen = await liveBusiness('canteen');
    const first = await join(canteen.slug, { customer: { name: 'Kiran Rao', phone: '9876543210' } });
    // The same number typed differently is still the same phone.
    const again = await join(canteen.slug, { customer: { name: 'Kiran R', phone: '+91 98765-43210' } });

    expect(again.status).toBe(200);
    expect(again.body.existing).toBe(true);
    expect(again.body.token.id).toBe(first.body.token.id);
    expect(again.body.guestSecret).toBeUndefined();
    expect(await Token.countDocuments()).toBe(1);
  });

  test('five taps on "Get my token" at the same instant create one token', async () => {
    const canteen = await liveBusiness('canteen');
    const body = { customer: { name: 'Kiran Rao', phone: '9876543210' } };
    const results = await Promise.all(Array.from({ length: 5 }, () => join(canteen.slug, body)));

    expect(await Token.countDocuments()).toBe(1);
    expect(new Set(results.map((r) => r.body.token.id)).size).toBe(1);
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
  });

  test('a queue that is not live, a paused queue, and an unknown slug are refused', async () => {
    const notLive = await liveBusiness('canteen', { isLive: false });
    const paused = await liveBusiness('canteen', { isOpen: false });

    const a = await join(notLive.slug, { customer: customer() });
    expect([a.status, a.body.error.code]).toEqual([409, 'not_live']);
    const b = await join(paused.slug, { customer: customer() });
    expect([b.status, b.body.error.code]).toEqual([409, 'closed']);
    expect((await join('no-such-place', { customer: customer() })).status).toBe(404);
  });

  test('the daily limit is the smaller of the owner limit and the plan limit', async () => {
    const business = await liveBusiness('canteen'); // Free plan: 50 a day; template limit 300
    expect(dailyLimit(business)).toBe(50);
    business.settings.maxTokensPerDay = 10;
    expect(dailyLimit(business)).toBe(10);
    business.plan = 'pro';
    business.settings.maxTokensPerDay = 300;
    expect(dailyLimit(business)).toBe(300);
  });

  test('once the daily limit is reached, joins are refused, and refusals do not use up numbers', async () => {
    const canteen = await liveBusiness('canteen', { 'settings.maxTokensPerDay': 2 });
    expect((await join(canteen.slug, { customer: customer() })).status).toBe(201);
    expect((await join(canteen.slug, { customer: customer() })).status).toBe(201);

    const full = await join(canteen.slug, { customer: customer() });
    expect(full.status).toBe(409);
    expect(full.body.error).toMatchObject({ code: 'limit', details: { limit: 2 } });

    await Business.updateOne({ _id: canteen._id }, { 'settings.maxTokensPerDay': 3 });
    const next = await join(canteen.slug, { customer: customer() });
    expect(next.body.token.code).toBe('T-003'); // not T-004: the refused join used nothing up
  });

  test('simultaneous joins cannot slip past the daily limit', async () => {
    const canteen = await liveBusiness('canteen', { 'settings.maxTokensPerDay': 5 });
    const results = await Promise.all(Array.from({ length: 10 }, () => join(canteen.slug, { customer: customer() })));
    expect(results.filter((r) => r.status === 201)).toHaveLength(5);
    expect(results.filter((r) => r.status === 409)).toHaveLength(5);
    expect(await Token.countDocuments()).toBe(5);
  });

  test('priority is ignored on plans without priority queues', async () => {
    const clinic = await liveBusiness('clinic'); // template turns allowPriority on; Free plan
    const free = await join(clinic.slug, { customer: customer({ age: 70 }), priority: true });
    expect(free.body.token.priority).toBe(false);

    await Business.updateOne({ _id: clinic._id }, { plan: 'business' });
    const paid = await join(clinic.slug, { customer: customer({ age: 70 }), priority: true });
    expect(paid.body.token.priority).toBe(true);
  });

  test("the business's custom join-form fields are validated, and unknown answers are dropped", async () => {
    const clinic = await liveBusiness('clinic'); // name, phone, and a required age

    const missing = await join(clinic.slug, { customer: { name: 'K', phone: '12345' } });
    expect(missing.status).toBe(400);
    expect(missing.body.error.details.map((d) => d.field)).toEqual(expect.arrayContaining(['customer.name', 'customer.phone', 'customer.age']));

    const notNumber = await join(clinic.slug, { customer: customer({ age: 'old' }) });
    expect(notNumber.body.error.details.map((d) => d.message)).toContain('Enter a number');

    const ok = await join(clinic.slug, { customer: customer({ age: '34', notOnTheForm: 'sneaky' }) });
    expect(ok.status).toBe(201);
    const saved = await Token.findById(ok.body.token.id).lean();
    expect(saved.customer.age).toBe(34);
    expect(saved.customer.notOnTheForm).toBeUndefined();
  });

  test('per resource: the chosen doctor sets the line; "any available" only when allowed', async () => {
    const clinic = await liveBusiness('clinic');
    const [doctor] = await Resource.find({ businessId: clinic._id });
    await Resource.create({ businessId: clinic._id, name: 'Dr. Second', serviceIds: doctor.serviceIds, isActive: false });

    const res = await join(clinic.slug, { customer: customer({ age: 30 }), resourceId: String(doctor._id) });
    expect(res.body.token).toMatchObject({ queueKey: `res:${doctor._id}`, resourceId: String(doctor._id), code: 'A-001' });

    const any = await join(clinic.slug, { customer: customer({ age: 30 }), resourceId: 'any' });
    expect([any.status, any.body.error.code]).toEqual([400, 'CHOOSE_RESOURCE']);

    await Business.updateOne({ _id: clinic._id }, { 'settings.allowAnyAvailable': true });
    const allowed = await join(clinic.slug, { customer: customer({ age: 30 }), resourceId: 'any' });
    expect(allowed.body.token.queueKey).toBe('res:any');
  });

  test('per service: with several services the customer must choose one, and its prefix is used', async () => {
    const bank = await liveBusiness('bank');
    const loans = await Service.findOne({ businessId: bank._id, name: 'Loans' });

    const unchosen = await join(bank.slug, { customer: customer() });
    expect([unchosen.status, unchosen.body.error.code]).toEqual([400, 'CHOOSE_SERVICE']);

    const res = await join(bank.slug, { customer: customer(), serviceId: String(loans._id) });
    expect(res.body.token).toMatchObject({ queueKey: `svc:${loans._id}`, code: 'L-001' });
  });

  test('an inactive or unknown service cannot be joined', async () => {
    const bank = await liveBusiness('bank');
    const loans = await Service.findOneAndUpdate({ businessId: bank._id, name: 'Loans' }, { isActive: false });
    const res = await join(bank.slug, { customer: customer(), serviceId: String(loans._id) });
    expect([res.status, res.body.error.code]).toEqual([400, 'SERVICE_NOT_AVAILABLE']);
  });
});

/* --------------------------------------------- Step 9.4: status page */

describe('token status', () => {
  const status = (slug, id) => request(app).get(`/api/public/${slug}/tokens/${id}`);

  test('a waiting token shows people ahead, the wait, progress, and what is being served', async () => {
    const canteen = await liveBusiness('canteen'); // 1 counter, 5 minutes each
    const [counter] = await Resource.find({ businessId: canteen._id });
    const owner = await User.findOne({ businessId: canteen._id });
    const { issueTokens } = await import('../src/services/auth.service.js');
    const auth = `Bearer ${issueTokens(owner).accessToken}`;

    const ids = [];
    for (let i = 0; i < 4; i += 1) ids.push((await join(canteen.slug, { customer: customer() })).body.token.id);

    let res = await status(canteen.slug, ids[3]);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ahead: 3, waitMinutes: 18, progress: 25, nowServing: null, resource: null, service: { name: 'General' } });
    expect(JSON.stringify(res.body)).not.toMatch(/Kiran|phone|guestSecret/);

    await request(app).post(`/api/staff/resources/${counter.id}/call-next`).set('Authorization', auth);
    res = await status(canteen.slug, ids[3]);
    expect(res.body).toMatchObject({ ahead: 2, waitMinutes: 13, progress: 50, nowServing: 'T-001' });

    const called = await status(canteen.slug, ids[0]);
    expect(called.body).toMatchObject({ token: { status: 'CALLED' }, ahead: 0, waitMinutes: 0, progress: 100, resource: { id: counter.id, name: 'Counter 1' } });
  });

  test("a token from another business, or an unknown id, is not found", async () => {
    const a = await liveBusiness('canteen');
    const b = await liveBusiness('canteen');
    const tokenOfB = (await join(b.slug, { customer: customer() })).body.token.id;
    expect((await status(a.slug, tokenOfB)).status).toBe(404);
    expect((await status(a.slug, new mongoose.Types.ObjectId())).status).toBe(404);
    expect((await status(a.slug, 'not-an-id')).status).toBe(400);
  });
});

/* ------------------------------------- Step 9.6: leaving and rating */

describe('customer actions', () => {
  const leave = (slug, id, body) => request(app).post(`/api/public/${slug}/tokens/${id}/leave`).send(body);
  const rate = (slug, id, body) => request(app).post(`/api/public/${slug}/tokens/${id}/rate`).send(body);

  // A canteen with one waiting customer, plus a way to finish their visit as staff.
  async function waitingCustomer() {
    const canteen = await liveBusiness('canteen');
    const joined = (await join(canteen.slug, { customer: customer() })).body;
    const owner = await User.findOne({ businessId: canteen._id });
    const { issueTokens } = await import('../src/services/auth.service.js');
    const auth = `Bearer ${issueTokens(owner).accessToken}`;
    const [counter] = await Resource.find({ businessId: canteen._id });
    const finishVisit = async () => {
      await request(app).post(`/api/staff/resources/${counter.id}/call-next`).set('Authorization', auth);
      await request(app).post(`/api/staff/tokens/${joined.token.id}/done`).set('Authorization', auth);
    };
    return { canteen, id: joined.token.id, secret: joined.guestSecret, finishVisit };
  }

  test('leaving the line needs the guest secret', async () => {
    const { canteen, id, secret } = await waitingCustomer();

    const missing = await leave(canteen.slug, id, {});
    expect(missing.status).toBe(400);
    const wrong = await leave(canteen.slug, id, { guestSecret: 'not-the-right-secret' });
    expect([wrong.status, wrong.body.error.code]).toEqual([403, 'INVALID_SECRET']);
    expect((await Token.findById(id)).status).toBe('WAITING');

    const res = await leave(canteen.slug, id, { guestSecret: secret });
    expect(res.status).toBe(200);
    expect(res.body.token.status).toBe('CANCELLED');
    expect((await Token.findById(id)).cancelledBy).toBe('customer');
  });

  test('a customer can only leave while waiting, and leaving frees their phone', async () => {
    const { canteen, id, secret } = await waitingCustomer();
    await leave(canteen.slug, id, { guestSecret: secret });
    const again = await leave(canteen.slug, id, { guestSecret: secret });
    expect([again.status, again.body.error.code]).toEqual([409, 'INVALID_TRANSITION']);

    const token = await Token.findById(id);
    const rejoin = await join(canteen.slug, { customer: { name: 'Kiran Rao', phone: token.customer.phone } });
    expect(rejoin.status).toBe(201);
  });

  test("a secret from another token does not work", async () => {
    const { canteen, id } = await waitingCustomer();
    const other = (await join(canteen.slug, { customer: customer() })).body;
    const res = await leave(canteen.slug, id, { guestSecret: other.guestSecret });
    expect(res.status).toBe(403);
  });

  test('rating works once, only after the visit is done, and only from 1 to 5', async () => {
    const { canteen, id, secret, finishVisit } = await waitingCustomer();

    const tooEarly = await rate(canteen.slug, id, { guestSecret: secret, rating: 5 });
    expect([tooEarly.status, tooEarly.body.error.code]).toEqual([409, 'INVALID_TRANSITION']);

    await finishVisit();
    expect((await rate(canteen.slug, id, { guestSecret: secret, rating: 6 })).status).toBe(400);
    expect((await rate(canteen.slug, id, { guestSecret: 'wrong-secret-123', rating: 5 })).status).toBe(403);

    const res = await rate(canteen.slug, id, { guestSecret: secret, rating: 4 });
    expect(res.status).toBe(200);
    expect(res.body.token.rating).toBe(4);
    expect(await ActivityLog.exists({ businessId: canteen._id, kind: 'rating' })).toBeTruthy();

    const twice = await rate(canteen.slug, id, { guestSecret: secret, rating: 1 });
    expect([twice.status, twice.body.error.code]).toEqual([409, 'ALREADY_RATED']);
    expect((await Token.findById(id)).rating).toBe(4);
  });
});
