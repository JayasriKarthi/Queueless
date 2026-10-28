import http from 'node:http';
import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { io as connect } from 'socket.io-client';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import app from '../app.js';
import { env } from '../src/config/env.js';
import { Redis } from 'ioredis';
import { initSockets, emitTo, closeSockets } from '../src/sockets/index.js';
import { rooms, MAX_GUEST_ROOMS } from '../src/sockets/rooms.js';
import { issueTokens } from '../src/services/auth.service.js';
import { User } from '../src/models/User.js';
import { Business } from '../src/models/Business.js';
import { Service } from '../src/models/Service.js';
import { Resource } from '../src/models/Resource.js';
import { Token } from '../src/models/Token.js';
import { Queue } from '../src/models/Queue.js';
import { ActivityLog } from '../src/models/ActivityLog.js';
import { SlugHistory } from '../src/models/SlugHistory.js';

const MODELS = [User, Business, Service, Resource, Token, Queue, ActivityLog, SlugHistory];
let mongo;
let server;
let io;
let url;
const sockets = [];

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await mongoose.connect(mongo.getUri('queueless_socket_test'));
  await Promise.all(MODELS.map((m) => m.syncIndexes()));
  server = http.createServer(app);
  io = initSockets(server); // one instance, no Redis needed
  await new Promise((resolve) => server.listen(0, resolve));
  url = `http://localhost:${server.address().port}`;
});

afterEach(async () => {
  sockets.splice(0).forEach((s) => s.close());
  await Promise.all(MODELS.map((m) => m.deleteMany({})));
});

afterAll(async () => {
  await new Promise((resolve) => io.close(resolve));
  await mongoose.disconnect();
  await mongo.stop();
});

/* ---------------------------------------------------------- helpers */

// Resolves once connected, or with the refusal if the handshake is rejected.
const open = (auth) =>
  new Promise((resolve) => {
    const socket = connect(url, { auth, transports: ['websocket'], reconnection: false, forceNew: true });
    sockets.push(socket);
    socket.on('connect', () => resolve({ socket, ok: true }));
    socket.on('connect_error', (err) => resolve({ socket, ok: false, code: err.data?.code }));
  });

const ask = (socket, event, payload) => new Promise((resolve) => socket.emit(event, payload, resolve));

// Waits for an event; resolves null if it does not arrive (to prove something was NOT received).
const receive = (socket, event, ms = 400) =>
  new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    socket.once(event, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });

let n = 0;
async function business({ plan = 'free', isLive = true } = {}) {
  n += 1;
  const res = await request(app).post('/api/auth/signup').send({
    name: 'Owner', email: `owner${n}@test.example`, password: 'Sunrise#2024', businessName: `Canteen ${n}`, businessType: 'canteen', terms: true,
  });
  const doc = await Business.findByIdAndUpdate(res.body.business.id, { plan, isLive }, { returnDocument: 'after' });
  return { business: doc, ownerToken: res.body.accessToken };
}

/* ------------------------------------------------------------ tests */

describe('business rooms (owners and staff)', () => {
  test('a logged-in socket joins its own business room automatically and never sees another business', async () => {
    const a = await business();
    const b = await business();
    const { socket: ownerA } = await open({ token: a.ownerToken });
    const { socket: ownerB } = await open({ token: b.ownerToken });
    const { socket: guest } = await open();

    const gotA = receive(ownerA, 'queue:updated');
    const gotB = receive(ownerB, 'queue:updated');
    const gotGuest = receive(guest, 'queue:updated');
    expect(emitTo(rooms.business(a.business._id), 'queue:updated', { waiting: 3 })).toBe(true);

    expect(await gotA).toEqual({ waiting: 3 });
    expect(await gotB).toBeNull();
    expect(await gotGuest).toBeNull();
  });

  test('bad, expired, or deactivated logins are refused with a code', async () => {
    const a = await business();
    const owner = await User.findOne({ businessId: a.business._id });
    const expired = jwt.sign({ businessId: String(a.business._id), role: 'owner' }, env.JWT_ACCESS_SECRET, { subject: String(owner._id), expiresIn: -5 });

    expect((await open({ token: 'not-a-token' })).code).toBe('UNAUTHORIZED');
    expect((await open({ token: expired })).code).toBe('TOKEN_EXPIRED');
    await User.updateOne({ _id: owner._id }, { status: 'deactivated' });
    expect((await open({ token: issueTokens(owner).accessToken })).code).toBe('UNAUTHORIZED');
  });
});

describe('display rooms (TVs)', () => {
  test('only live businesses on a plan with the TV display can be joined', async () => {
    const free = await business({ plan: 'free' });
    const notLive = await business({ plan: 'pro', isLive: false });
    const pro = await business({ plan: 'pro' });
    const { socket } = await open();

    expect((await ask(socket, 'display:join', { slug: free.business.slug })).error.code).toBe('PLAN_REQUIRED');
    expect((await ask(socket, 'display:join', { slug: notLive.business.slug })).error.code).toBe('not_live');
    expect((await ask(socket, 'display:join', { slug: 'no-such-place' })).error.code).toBe('BUSINESS_NOT_FOUND');
    expect((await ask(socket, 'display:join', {})).error.code).toBe('VALIDATION_ERROR');

    const joined = await ask(socket, 'display:join', { slug: pro.business.slug });
    expect(joined).toMatchObject({ ok: true, business: { slug: pro.business.slug } });
    const got = receive(socket, 'token:called');
    emitTo(rooms.display(pro.business._id), 'token:called', { code: 'T-001' });
    expect(await got).toEqual({ code: 'T-001' });
  });

  test('an old slug still in its redirect window joins the business under its new name', async () => {
    const pro = await business({ plan: 'pro' });
    await SlugHistory.create({ businessId: pro.business._id, slug: 'old-name', redirectUntil: new Date(Date.now() + 86400000) });
    const { socket } = await open();
    const joined = await ask(socket, 'display:join', { slug: 'old-name' });
    expect(joined.business.slug).toBe(pro.business.slug);
  });
});

describe('public and token rooms (customers)', () => {
  test('a join page follows its business by slug', async () => {
    const a = await business();
    const { socket } = await open();
    expect((await ask(socket, 'public:join', { slug: a.business.slug })).ok).toBe(true);
    const got = receive(socket, 'queue:updated');
    emitTo(rooms.public(a.business._id), 'queue:updated', { waiting: 1 });
    expect(await got).toEqual({ waiting: 1 });
  });

  test("a phone can follow its own token only with the token's secret", async () => {
    const a = await business();
    const joined = await request(app).post(`/api/public/${a.business.slug}/tokens`).send({ customer: { name: 'Kiran Rao', phone: '9876543210' } });
    const { id } = joined.body.token;
    const { socket } = await open();

    const wrong = await ask(socket, 'token:join', { slug: a.business.slug, tokenId: id, guestSecret: 'not-the-secret' });
    expect(wrong.error.code).toBe('INVALID_SECRET');

    const other = await business();
    const wrongBusiness = await ask(socket, 'token:join', { slug: other.business.slug, tokenId: id, guestSecret: joined.body.guestSecret });
    expect(wrongBusiness.error.code).toBe('TOKEN_NOT_FOUND');

    const ok = await ask(socket, 'token:join', { slug: a.business.slug, tokenId: id, guestSecret: joined.body.guestSecret });
    expect(ok).toMatchObject({ ok: true, token: { id, code: 'T-001', status: 'WAITING' } });
    const got = receive(socket, 'token:updated');
    emitTo(rooms.token(id), 'token:updated', { status: 'CALLED' });
    expect(await got).toEqual({ status: 'CALLED' });
  });

  test('one guest connection cannot join an unlimited number of rooms', async () => {
    const a = await business();
    const { socket } = await open();
    // Joining the same room again does not count twice, so use different businesses.
    const slugs = [a.business.slug];
    for (let i = 1; i < MAX_GUEST_ROOMS + 1; i += 1) slugs.push((await business()).business.slug);
    const answers = [];
    for (const slug of slugs) answers.push(await ask(socket, 'public:join', { slug }));
    expect(answers.slice(0, MAX_GUEST_ROOMS).every((r) => r.ok)).toBe(true);
    expect(answers.at(-1).error.code).toBe('TOO_MANY_ROOMS');
  });
});

/* ============================================ Step 10.3: live events */

// Waits for the first `event` whose payload passes `match`; null if none arrives in time.
const waitFor = (socket, event, match = () => true, ms = 2000) =>
  new Promise((resolve) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      resolve(null);
    }, ms);
    function handler(data) {
      if (!match(data)) return;
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(data);
    }
    socket.on(event, handler);
  });

// Everything a socket receives, to check what a room is (and is not) sent.
const record = (socket) => {
  const seen = [];
  socket.onAny((event, data) => seen.push({ event, data }));
  return seen;
};

// A live Pro canteen with: two staff screens, a TV, a join page, and two waiting customers
// following their own tokens.
async function liveScene() {
  const { business: biz, ownerToken } = await business({ plan: 'pro' });
  const [counter] = await Resource.find({ businessId: biz._id });
  const join = (name, phone) => request(app).post(`/api/public/${biz.slug}/tokens`).send({ customer: { name, phone } });
  const first = (await join('Kiran Rao', '9876500001')).body;
  const second = (await join('Asha Nair', '9876500002')).body;

  const { socket: staffA } = await open({ token: ownerToken });
  const { socket: staffB } = await open({ token: ownerToken }); // a second staff screen
  const { socket: tv } = await open();
  const { socket: joinPage } = await open();
  const { socket: phone1 } = await open();
  const { socket: phone2 } = await open();
  await ask(tv, 'display:join', { slug: biz.slug });
  await ask(joinPage, 'public:join', { slug: biz.slug });
  await ask(phone1, 'token:join', { slug: biz.slug, tokenId: first.token.id, guestSecret: first.guestSecret });
  await ask(phone2, 'token:join', { slug: biz.slug, tokenId: second.token.id, guestSecret: second.guestSecret });

  const callNext = () => request(app).post(`/api/staff/resources/${counter.id}/call-next`).set('Authorization', `Bearer ${ownerToken}`);
  return { biz, counter, ownerToken, first, second, staffA, staffB, tv, joinPage, phone1, phone2, callNext };
}

describe('live events (Done when #1)', () => {
  test('calling a token updates the customer page, the TV, and other staff screens without a refresh', async () => {
    const s = await liveScene();

    const phoneCalled = waitFor(s.phone1, 'token:called');
    const phoneStatus = waitFor(s.phone1, 'token:updated', (d) => d.token.status === 'CALLED');
    const tvCalled = waitFor(s.tv, 'token:called');
    const otherScreen = waitFor(s.staffB, 'token:updated', (d) => d.token.status === 'CALLED');
    const nextInLine = waitFor(s.phone2, 'token:updated', (d) => d.ahead === 0);
    const counts = waitFor(s.joinPage, 'queue:updated');

    expect((await s.callNext()).status).toBe(200);

    expect(await phoneCalled).toEqual({ code: 'T-001', resource: { id: s.counter.id, name: 'Counter 1' } });
    expect(await phoneStatus).toMatchObject({ token: { code: 'T-001', status: 'CALLED' }, resource: { name: 'Counter 1' }, ahead: 0 });
    expect(await tvCalled).toEqual({ code: 'T-001', resource: { id: s.counter.id, name: 'Counter 1' } });
    expect(await otherScreen).toMatchObject({ token: { code: 'T-001', customer: { name: 'Kiran Rao' } } });
    expect(await nextInLine).toMatchObject({ token: { code: 'T-002' }, ahead: 0, waitMinutes: 3, nowServing: 'T-001' });
    expect(await counts).toMatchObject({ waiting: 1, lines: { shared: 1 } });
  });

  test('a new customer joining updates staff screens and join pages', async () => {
    const s = await liveScene();
    const created = waitFor(s.staffA, 'token:created');
    const counts = waitFor(s.joinPage, 'queue:updated', (d) => d.waiting === 3);
    await request(app).post(`/api/public/${s.biz.slug}/tokens`).send({ customer: { name: 'Ravi Kumar', phone: '9876500003' } });
    expect(await created).toMatchObject({ token: { code: 'T-003', customer: { name: 'Ravi Kumar' } } });
    expect(await counts).toMatchObject({ waiting: 3 });
  });

  test('settings changes reach join pages and TVs (business:updated)', async () => {
    const s = await liveScene();
    const toPage = waitFor(s.joinPage, 'business:updated');
    const toTv = waitFor(s.tv, 'business:updated');
    await request(app).patch('/api/business/branding').set('Authorization', `Bearer ${s.ownerToken}`).send({ brandColor: '#2563EB' });
    expect(await toPage).toMatchObject({ slug: s.biz.slug, isOpen: true, branding: { brandColor: '#2563EB' } });
    expect(await toTv).toMatchObject({ branding: { brandColor: '#2563EB' } });
  });
});

describe('who receives what (Done when #2 and Step 10.4)', () => {
  test("a socket with business A's login never receives business B's events", async () => {
    const a = await liveScene();
    const { ownerToken: bToken } = await business({ plan: 'pro' });
    const { socket: ownerB } = await open({ token: bToken });
    const seenByB = record(ownerB);

    await a.callNext();
    await waitFor(a.staffA, 'queue:updated');
    await new Promise((r) => setTimeout(r, 300));
    expect(seenByB).toEqual([]);
  });

  test('join pages and TVs never receive customer names or phone numbers', async () => {
    const s = await liveScene();
    const seenByTv = record(s.tv);
    const seenByPage = record(s.joinPage);

    await request(app).post(`/api/public/${s.biz.slug}/tokens`).send({ customer: { name: 'Ravi Kumar', phone: '9876500003' } });
    await s.callNext();
    await s.callNext();
    await waitFor(s.staffA, 'queue:updated', (d) => d.waiting === 1);
    await new Promise((r) => setTimeout(r, 300));

    const everything = JSON.stringify([...seenByTv, ...seenByPage]);
    expect(seenByTv.length + seenByPage.length).toBeGreaterThan(0);
    for (const secret of ['Kiran', 'Asha', 'Ravi', '98765000', 'customer', 'phone']) expect(everything).not.toContain(secret);
  });

  test("a phone only hears about its own token, never another customer's details", async () => {
    const s = await liveScene();
    const seenByPhone2 = record(s.phone2);
    await s.callNext(); // calls the other customer (T-001)
    await waitFor(s.staffA, 'queue:updated');
    await new Promise((r) => setTimeout(r, 300));
    const everything = JSON.stringify(seenByPhone2);
    expect(everything).not.toContain('Kiran');
    expect(seenByPhone2.every(({ data }) => !data.token || data.token.code === 'T-002')).toBe(true);
  });
});

describe('several server instances (Done when #3)', () => {
  // Needs a real Redis (the local ql-redis container). Without one, this test says so and passes.
  test('an event raised on one instance reaches a client connected to another, through Redis', async () => {
    const probe = new Redis(process.env.REDIS_URL, { lazyConnect: true, connectTimeout: 1000, maxRetriesPerRequest: 0, retryStrategy: () => null });
    probe.on('error', () => {});
    const redisUp = await probe.connect().then(() => true, () => false);
    probe.disconnect();
    if (!redisUp) {
      console.warn('Redis is not reachable; skipping the multi-instance check');
      return;
    }

    // Instance A: where the TV is connected. Instance B: the one that handles the staff request.
    const pair = () => ({ pubClient: new Redis(process.env.REDIS_URL), subClient: new Redis(process.env.REDIS_URL) });
    const pairA = pair();
    const pairB = pair();
    const serverA = http.createServer(app);
    const ioA = initSockets(serverA, pairA);
    await new Promise((r) => serverA.listen(0, r));
    const serverB = http.createServer(app);
    initSockets(serverB, pairB); // the active instance: emitQueueEvent now sends through B
    await new Promise((r) => serverB.listen(0, r));
    await new Promise((r) => setTimeout(r, 300)); // let the Redis subscriptions settle

    try {
      const { business: biz, ownerToken } = await business({ plan: 'pro' });
      await request(app).post(`/api/public/${biz.slug}/tokens`).send({ customer: { name: 'Kiran Rao', phone: '9876500009' } });
      const tv = connect(`http://localhost:${serverA.address().port}`, { transports: ['websocket'], reconnection: false, forceNew: true });
      sockets.push(tv);
      await new Promise((r) => tv.on('connect', r));
      await ask(tv, 'display:join', { slug: biz.slug });

      const called = waitFor(tv, 'token:called');
      const [counter] = await Resource.find({ businessId: biz._id });
      await request(app).post(`/api/staff/resources/${counter.id}/call-next`).set('Authorization', `Bearer ${ownerToken}`);
      expect(await called).toMatchObject({ code: 'T-001' });
    } finally {
      // B is the active instance: closeSockets() stops late background broadcasts first,
      // exactly as server.js does on shutdown.
      await closeSockets();
      await new Promise((r) => ioA.close(r));
      // quit() lets the adapter finish unsubscribing; cutting the connection mid-command fails it.
      await Promise.all([...Object.values(pairA), ...Object.values(pairB)].map((c) => c.quit().catch(() => {})));
    }
  });
});
