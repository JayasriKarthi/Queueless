import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import app from '../app.js';
import { Token } from '../src/models/Token.js';
import { Queue } from '../src/models/Queue.js';
import { User } from '../src/models/User.js';
import { Business } from '../src/models/Business.js';
import { Service } from '../src/models/Service.js';
import { Resource } from '../src/models/Resource.js';
import { ActivityLog } from '../src/models/ActivityLog.js';
import { issueTokens } from '../src/services/auth.service.js';
import { estimateMinutes, serversFor } from '../src/services/eta.service.js';
import {
  queueKeyFor, prefixFor, waitingFor, nextFor, aheadOf, resourceCanServe, skipToEndUpdate, currentFor,
} from '../src/services/queue.service.js';

const { ObjectId } = mongoose.Types;
const MODELS = [Token, Queue, User, Business, Service, Resource, ActivityLog];
let mongo;

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await mongoose.connect(mongo.getUri('queueless_queue_test'));
  await Promise.all(MODELS.map((m) => m.syncIndexes()));
});

afterEach(() => Promise.all(MODELS.map((m) => m.deleteMany({}))));

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

/* ---------------------------------------------------------- helpers */

// Plain objects shaped like the Business and Resource documents the services receive.
const svcA = new ObjectId();
const svcB = new ObjectId();
const business = (queueMode) => ({ _id: new ObjectId(), settings: { queueMode, tokenPrefix: 'T' } });
const resource = (serviceIds) => ({ _id: new ObjectId(), serviceIds });

let seq = 0;
const t0 = Date.now() - 60 * 60 * 1000;
// Tokens join one second apart in the order they are created.
function addToken(biz, { queueKey, serviceId = svcA, priority = false, status = 'WAITING', code, resourceId = null } = {}) {
  seq += 1;
  return Token.create({
    businessId: biz._id, queueKey, number: seq, code: code ?? `X-${seq}`, serviceId, resourceId, priority, status,
    sortAt: new Date(t0 + seq * 1000), customer: { name: 'Kiran Rao', phone: '9876543210' }, guestSecretHash: 'x',
  });
}
const codes = async (query) => (await query).map((t) => t.code);

/* ----------------------------------------------- Step 9.1: queue keys */

describe('queue keys and prefixes', () => {
  test('each queue mode puts tokens in the right line', () => {
    const r = new ObjectId();
    expect(queueKeyFor(business('shared'), { serviceId: svcA })).toBe('shared');
    expect(queueKeyFor(business('per_service'), { serviceId: svcA })).toBe(`svc:${svcA}`);
    expect(queueKeyFor(business('per_resource'), { serviceId: svcA, resourceId: r })).toBe(`res:${r}`);
    expect(queueKeyFor(business('per_resource'), { serviceId: svcA })).toBe('res:any');
  });

  test("shared lines use the business's prefix; other modes use the service's", () => {
    const service = { prefix: 'C' };
    expect(prefixFor(business('shared'), service)).toBe('T');
    expect(prefixFor(business('per_service'), service)).toBe('C');
    expect(prefixFor(business('per_resource'), service)).toBe('C');
  });
});

describe('order inside a line', () => {
  test('waiting tokens are ordered by priority, then arrival', async () => {
    const biz = business('shared');
    const counter = resource([svcA]);
    await addToken(biz, { queueKey: 'shared', code: 'first' });
    await addToken(biz, { queueKey: 'shared', code: 'second' });
    await addToken(biz, { queueKey: 'shared', code: 'priority-late', priority: true });
    await addToken(biz, { queueKey: 'shared', code: 'third' });
    await addToken(biz, { queueKey: 'shared', code: 'already-called', status: 'CALLED' });

    expect(await codes(waitingFor(biz, counter))).toEqual(['priority-late', 'first', 'second', 'third']);
    expect((await nextFor(biz, counter)).code).toBe('priority-late');
  });

  test('skip moves a token to the end of its line and clears its priority', async () => {
    const biz = business('shared');
    const counter = resource([svcA]);
    const skipped = await addToken(biz, { queueKey: 'shared', code: 'skipped', priority: true });
    await addToken(biz, { queueKey: 'shared', code: 'next' });
    await addToken(biz, { queueKey: 'shared', code: 'last' });

    await Token.updateOne({ _id: skipped._id }, skipToEndUpdate());
    expect(await codes(waitingFor(biz, counter))).toEqual(['next', 'last', 'skipped']);
  });

  test('people ahead counts only the same line, in call order', async () => {
    const biz = business('per_service');
    const a1 = await addToken(biz, { queueKey: `svc:${svcA}` });
    await addToken(biz, { queueKey: `svc:${svcB}`, serviceId: svcB }); // another line
    const a2 = await addToken(biz, { queueKey: `svc:${svcA}` });
    const vip = await addToken(biz, { queueKey: `svc:${svcA}`, priority: true });
    const a3 = await addToken(biz, { queueKey: `svc:${svcA}` });

    expect(await aheadOf(vip)).toBe(0);
    expect(await aheadOf(a1)).toBe(1); // only the priority token
    expect(await aheadOf(a2)).toBe(2);
    expect(await aheadOf(a3)).toBe(3);
  });

  test('tokens that joined at the exact same moment still get a stable order', async () => {
    const biz = business('shared');
    const same = new Date();
    const make = (code) => Token.create({
      businessId: biz._id, queueKey: 'shared', number: 1, code, serviceId: svcA, sortAt: same,
      customer: { name: 'Kiran Rao', phone: '9876543210' }, guestSecretHash: 'x',
    });
    const first = await make('one');
    const second = await make('two');
    expect([await aheadOf(first), await aheadOf(second)]).toEqual([0, 1]);
  });
});

describe('who can call whom', () => {
  test('per service: a counter calls only tokens for services it handles', async () => {
    const biz = business('per_service');
    const cashOnly = resource([svcA]);
    const both = resource([svcA, svcB]);
    await addToken(biz, { queueKey: `svc:${svcA}`, serviceId: svcA, code: 'cash' });
    await addToken(biz, { queueKey: `svc:${svcB}`, serviceId: svcB, code: 'loan' });

    expect(await codes(waitingFor(biz, cashOnly))).toEqual(['cash']);
    expect(await codes(waitingFor(biz, both))).toEqual(['cash', 'loan']);
  });

  test("per resource: a doctor calls their own line plus 'any available' tokens for their services", async () => {
    const biz = business('per_resource');
    const drRao = resource([svcA]);
    const drMenon = resource([svcB]);
    await addToken(biz, { queueKey: `res:${drRao._id}`, code: 'rao-1' });
    await addToken(biz, { queueKey: `res:${drMenon._id}`, serviceId: svcB, code: 'menon-1' });
    await addToken(biz, { queueKey: 'res:any', serviceId: svcA, code: 'any-general' });
    await addToken(biz, { queueKey: 'res:any', serviceId: svcB, code: 'any-child' });

    expect(await codes(waitingFor(biz, drRao))).toEqual(['rao-1', 'any-general']);
    expect(await codes(waitingFor(biz, drMenon))).toEqual(['menon-1', 'any-child']);
  });

  test('shared: every counter calls from the one line', async () => {
    const biz = business('shared');
    await addToken(biz, { queueKey: 'shared', code: 'one' });
    await addToken(biz, { queueKey: 'shared', serviceId: svcB, code: 'two' });
    expect(await codes(waitingFor(biz, resource([svcA])))).toEqual(['one', 'two']);
  });

  test("a token in one doctor's line stays there even after switching to a shared line", async () => {
    const drRao = resource([svcA]);
    const drMenon = resource([svcA]);
    const before = business('per_resource');
    await addToken(before, { queueKey: `res:${drRao._id}`, code: 'waiting-for-rao' });

    const after = { ...before, settings: { queueMode: 'shared' } };
    await addToken(after, { queueKey: 'shared', code: 'joined-after-switch' });

    expect(await codes(waitingFor(after, drRao))).toEqual(['waiting-for-rao', 'joined-after-switch']);
    expect(await codes(waitingFor(after, drMenon))).toEqual(['joined-after-switch']);
  });

  test('resourceCanServe agrees with the line filter for a single token', () => {
    const biz = business('per_resource');
    const dr = resource([svcA]);
    const other = new ObjectId();
    expect(resourceCanServe(biz, dr, { queueKey: `res:${dr._id}`, serviceId: svcB })).toBe(true);
    expect(resourceCanServe(biz, dr, { queueKey: `res:${other}`, serviceId: svcA })).toBe(false);
    expect(resourceCanServe(biz, dr, { queueKey: 'res:any', serviceId: svcA })).toBe(true);
    expect(resourceCanServe(biz, dr, { queueKey: 'res:any', serviceId: svcB })).toBe(false);
    expect(resourceCanServe(business('shared'), dr, { queueKey: 'shared', serviceId: svcB })).toBe(true);
  });

  test("currentFor returns the resource's most recently called token", async () => {
    const biz = business('shared');
    const counter = resource([svcA]);
    const older = await addToken(biz, { queueKey: 'shared', status: 'SERVING', resourceId: counter._id, code: 'older' });
    const newer = await addToken(biz, { queueKey: 'shared', status: 'CALLED', resourceId: counter._id, code: 'newer' });
    await Token.updateOne({ _id: older._id }, { calledAt: new Date(Date.now() - 60000) });
    await Token.updateOne({ _id: newer._id }, { calledAt: new Date() });
    expect((await currentFor(biz._id, counter._id)).code).toBe('newer');
  });
});

/* ------------------------------------------- Step 9.4: wait estimates */

describe('wait estimates', () => {
  test('match round((ahead + 0.5) × average minutes ÷ servers)', () => {
    expect(estimateMinutes({ ahead: 3, avgMinutes: 12, servers: 1 })).toBe(42);
    expect(estimateMinutes({ ahead: 3, avgMinutes: 12, servers: 2 })).toBe(21);
    expect(estimateMinutes({ ahead: 0, avgMinutes: 10, servers: 1 })).toBe(5);
    expect(estimateMinutes({ ahead: 2, avgMinutes: 5, servers: 0 })).toBe(13); // never divides by zero
  });

  test('servers: 1 for a doctor’s own line, resources doing the service for a service line, everyone for a shared line', async () => {
    const biz = { _id: new ObjectId() };
    const make = (serviceIds, extra = {}) => Resource.create({ businessId: biz._id, name: 'R', serviceIds, ...extra });
    await make([svcA]);
    await make([svcA, svcB]);
    await make([svcB]);
    await make([svcA], { isPaused: true }); // paused: not working
    await make([svcA], { isActive: false }); // switched off: not working

    expect(await serversFor(biz, { queueKey: `res:${new ObjectId()}`, serviceId: svcA })).toBe(1);
    expect(await serversFor(biz, { queueKey: `svc:${svcA}`, serviceId: svcA })).toBe(2);
    expect(await serversFor(biz, { queueKey: 'res:any', serviceId: svcB })).toBe(2);
    expect(await serversFor(biz, { queueKey: 'shared', serviceId: svcA })).toBe(3);
  });
});

/* ------------------------------------------- Step 9.5: staff actions */

let ownerSeq = 0;
// A live business on the Pro plan (room for several counters), plus helpers to call the API.
async function setup(businessType, { counters = 1 } = {}) {
  ownerSeq += 1;
  const res = await request(app).post('/api/auth/signup').send({
    name: 'Owner', email: `owner${ownerSeq}@test.example`, password: 'Sunrise#2024',
    businessName: `${businessType} ${ownerSeq}`, businessType, terms: true,
  });
  const business = await Business.findByIdAndUpdate(res.body.business.id, { isLive: true, plan: 'pro' }, { returnDocument: 'after' });
  const [first] = await Resource.find({ businessId: business._id });
  const resources = [first];
  for (let i = 2; i <= counters; i += 1) {
    resources.push(await Resource.create({ businessId: business._id, name: `Counter ${i}`, serviceIds: first.serviceIds }));
  }
  const ownerAuth = `Bearer ${res.body.accessToken}`;
  const as = (auth) => ({
    post: (path, body) => request(app).post(`/api/staff${path}`).set('Authorization', auth).send(body),
    patch: (path, body) => request(app).patch(`/api/staff${path}`).set('Authorization', auth).send(body),
    get: (path) => request(app).get(`/api/staff${path}`).set('Authorization', auth),
  });
  const staffUser = async (role, resourceId) => {
    const user = await User.create({ name: `${role} user`, email: `${role}${ownerSeq}${resourceId}@test.example`, passwordHash: 'x', role, businessId: business._id, resourceId });
    return as(`Bearer ${issueTokens(user).accessToken}`);
  };
  return { business, resources, owner: as(ownerAuth), staffUser };
}

let phone = 9000000000;
const joinAs = (slug, extra = {}) =>
  request(app).post(`/api/public/${slug}/tokens`).send({ customer: { name: 'Kiran Rao', phone: String((phone += 1)), age: 30 }, ...extra });

describe('calling tokens', () => {
  test('two staff calling next at the same moment never call the same customer', async () => {
    const { business, resources, owner } = await setup('canteen', { counters: 4 });
    for (let i = 0; i < 8; i += 1) await joinAs(business.slug);

    const round = () => Promise.all(resources.map((r) => owner.post(`/resources/${r.id}/call-next`)));
    const results = [...(await round()), ...(await round())];

    expect(results.every((r) => r.status === 200 && r.body.called)).toBe(true);
    const called = results.map((r) => r.body.called.code);
    expect(new Set(called).size).toBe(8); // 8 calls, 8 different customers
  });

  test('call next finishes the current customer and calls the next in order', async () => {
    const { business, resources: [counter], owner } = await setup('canteen');
    await joinAs(business.slug);
    await joinAs(business.slug);

    const first = await owner.post(`/resources/${counter.id}/call-next`);
    expect(first.body.called).toMatchObject({ code: 'T-001', status: 'CALLED', resourceId: counter.id, customer: { name: 'Kiran Rao' } });
    expect(first.body.finished).toBeNull();

    const second = await owner.post(`/resources/${counter.id}/call-next`);
    expect(second.body.called.code).toBe('T-002');
    expect(second.body.finished).toMatchObject({ code: 'T-001', status: 'DONE' });

    const empty = await owner.post(`/resources/${counter.id}/call-next`);
    expect(empty.body).toMatchObject({ called: null, finished: { code: 'T-002' }, message: 'Nobody is waiting for this line right now' });
  });

  test('arrived, done, recall, no-show, skip, and remove each make the right change', async () => {
    const { business, resources: [counter], owner } = await setup('canteen');
    const ids = [];
    for (let i = 0; i < 4; i += 1) ids.push((await joinAs(business.slug)).body.token.id);

    await owner.post(`/resources/${counter.id}/call-next`); // T-001 called
    const recalled = await owner.post(`/tokens/${ids[0]}/recall`);
    expect(recalled.body.token).toMatchObject({ status: 'CALLED' });
    expect((await Token.findById(ids[0])).recalls).toBe(1);

    expect((await owner.post(`/tokens/${ids[0]}/arrived`)).body.token.status).toBe('SERVING');
    const done = await owner.post(`/tokens/${ids[0]}/done`);
    expect(done.body.token).toMatchObject({ status: 'DONE' });
    expect(done.body.token.doneAt).toBeTruthy();

    const skipped = await owner.post(`/tokens/${ids[1]}/skip`); // T-002 to the back
    expect(skipped.body.token.status).toBe('WAITING');
    expect((await owner.post(`/resources/${counter.id}/call-next`)).body.called.code).toBe('T-003');

    expect((await owner.post(`/tokens/${ids[2]}/no-show`)).body.token.status).toBe('NO_SHOW');
    expect((await owner.post(`/tokens/${ids[3]}/remove`)).body.token.status).toBe('CANCELLED');
    expect((await Token.findById(ids[3])).cancelledBy).toBe('staff');
  });

  test('invalid status changes return 409 with a clear message', async () => {
    const { business, resources: [counter], owner } = await setup('canteen');
    const id = (await joinAs(business.slug)).body.token.id;

    const notCalled = await owner.post(`/tokens/${id}/arrived`);
    expect(notCalled.status).toBe(409);
    expect(notCalled.body.error).toMatchObject({ code: 'INVALID_TRANSITION', message: 'T-001 is waiting, so it cannot be marked as arrived.', details: { status: 'WAITING' } });

    await owner.post(`/resources/${counter.id}/call-next`);
    await owner.post(`/tokens/${id}/arrived`);
    expect((await owner.post(`/tokens/${id}/no-show`)).status).toBe(409); // already being served
    expect((await owner.post(`/tokens/${id}/done`)).status).toBe(200);
    const twice = await owner.post(`/tokens/${id}/done`);
    expect([twice.status, twice.body.error.message]).toEqual([409, 'T-001 is already done, so it cannot be marked as done.']);
    expect((await owner.post(`/tokens/${new ObjectId()}/done`)).status).toBe(404);
  });

  test('a finished token frees the phone, so the customer can join again', async () => {
    const { business, resources: [counter], owner } = await setup('canteen');
    const body = { customer: { name: 'Kiran Rao', phone: '9876543210' } };
    const first = await request(app).post(`/api/public/${business.slug}/tokens`).send(body);
    expect((await request(app).post(`/api/public/${business.slug}/tokens`).send(body)).body.existing).toBe(true);

    await owner.post(`/resources/${counter.id}/call-next`);
    await owner.post(`/tokens/${first.body.token.id}/done`);
    const again = await request(app).post(`/api/public/${business.slug}/tokens`).send(body);
    expect(again.status).toBe(201);
    expect(again.body.token.code).toBe('T-002');
  });

  test('"Call this one" calls a chosen customer, but only from a line the resource serves', async () => {
    const { business, resources: [counter], owner } = await setup('canteen');
    await joinAs(business.slug);
    const later = (await joinAs(business.slug)).body.token.id;
    const res = await owner.post(`/tokens/${later}/call`, { resourceId: counter.id });
    expect(res.body.token).toMatchObject({ code: 'T-002', status: 'CALLED', resourceId: counter.id });

    const bank = await setup('bank', { counters: 2 });
    const [cashOnly] = bank.resources;
    const loans = await Service.findOne({ businessId: bank.business._id, name: 'Loans' });
    await Resource.updateOne({ _id: cashOnly._id }, { serviceIds: [cashOnly.serviceIds[0]] });
    const loanToken = (await joinAs(bank.business.slug, { serviceId: String(loans._id) })).body.token.id;
    const refused = await bank.owner.post(`/tokens/${loanToken}/call`, { resourceId: cashOnly.id });
    expect([refused.status, refused.body.error.code]).toEqual([409, 'CANNOT_SERVE']);
  });

  test('a paused resource cannot call next until it is resumed', async () => {
    const { business, resources: [counter], owner } = await setup('canteen');
    await joinAs(business.slug);
    expect((await owner.patch(`/resources/${counter.id}/pause`, { isPaused: true })).body.resource.isPaused).toBe(true);
    const refused = await owner.post(`/resources/${counter.id}/call-next`);
    expect([refused.status, refused.body.error.code]).toEqual([409, 'RESOURCE_PAUSED']);
    await owner.patch(`/resources/${counter.id}/pause`, { isPaused: false });
    expect((await owner.post(`/resources/${counter.id}/call-next`)).body.called.code).toBe('T-001');
  });
});

describe('staff limits and the console', () => {
  async function clinicWithTwoDoctors() {
    const ctx = await setup('clinic', { counters: 2 });
    const [drRao, drMenon] = ctx.resources;
    const staff = await ctx.staffUser('staff', drRao._id);
    const manager = await ctx.staffUser('manager', null);
    return { ...ctx, drRao, drMenon, staff, manager };
  }

  test("staff can only call and act on their own doctor's line; managers can do both", async () => {
    const { business, drRao, drMenon, staff, manager } = await clinicWithTwoDoctors();
    const raoPatient = (await joinAs(business.slug, { resourceId: drRao.id })).body.token.id;
    const menonPatient = (await joinAs(business.slug, { resourceId: drMenon.id })).body.token.id;

    expect((await staff.post(`/resources/${drMenon.id}/call-next`)).status).toBe(403);
    expect((await staff.post(`/tokens/${menonPatient}/skip`)).status).toBe(403);
    expect((await staff.post(`/tokens/${menonPatient}/remove`)).status).toBe(403);

    expect((await staff.post(`/resources/${drRao.id}/call-next`)).body.called.id).toBe(raoPatient);
    expect((await manager.post(`/resources/${drMenon.id}/call-next`)).body.called.id).toBe(menonPatient);
  });

  test('a walk-in added by staff goes into their own line and is marked as a walk-in', async () => {
    const { drRao, drMenon, staff } = await clinicWithTwoDoctors();
    const res = await staff.post('/walk-in', { customer: { name: 'Walk In', phone: '9123456780', age: 50 }, resourceId: drMenon.id });
    expect(res.status).toBe(201);
    expect(res.body.token).toMatchObject({ queueKey: `res:${drRao.id}`, source: 'walk-in', customer: { name: 'Walk In' } });
    expect(res.body.guestSecret).toBeUndefined();
  });

  test("the console shows only the staff member's own line, with customers, the current token, and today's numbers", async () => {
    const { business, drRao, drMenon, staff, owner } = await clinicWithTwoDoctors();
    await joinAs(business.slug, { resourceId: drRao.id });
    await joinAs(business.slug, { resourceId: drRao.id });
    await joinAs(business.slug, { resourceId: drMenon.id });
    await staff.post(`/resources/${drRao.id}/call-next`);
    await staff.post(`/resources/${drRao.id}/call-next`); // first one done, second called

    const res = await staff.get('/console');
    expect(res.status).toBe(200);
    expect(res.body.business).toMatchObject({ name: business.name, queueMode: 'per_resource', labels: { resource: 'Doctor' } });
    expect(res.body.lines).toHaveLength(1);
    expect(res.body.lines[0]).toMatchObject({
      resource: { id: drRao.id },
      current: { code: 'A-002', status: 'CALLED', customer: { name: 'Kiran Rao', age: 30 } },
      waitingCount: 0,
      metrics: { served: 1, noShows: 0 },
    });

    const ownerView = await owner.get('/console');
    expect(ownerView.body.lines).toHaveLength(2);
    expect(ownerView.body.lines.find((l) => l.resource.id === drMenon.id).waiting.map((t) => t.code)).toEqual(['A-003']);
    expect((await staff.get(`/console?resourceId=${drMenon.id}`)).status).toBe(403);
  });
});
