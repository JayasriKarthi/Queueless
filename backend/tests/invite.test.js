import crypto from 'node:crypto';
import request from 'supertest';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import app from '../app.js';
import { User } from '../src/models/User.js';
import { Business } from '../src/models/Business.js';
import { Service } from '../src/models/Service.js';
import { Resource } from '../src/models/Resource.js';
import { StaffInvite } from '../src/models/StaffInvite.js';
import { ActivityLog } from '../src/models/ActivityLog.js';
import { outbox } from '../src/services/notification.service.js';
import { issueTokens } from '../src/services/auth.service.js';

const MODELS = [User, Business, Service, Resource, StaffInvite, ActivityLog];
let mongo;

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await mongoose.connect(mongo.getUri('queueless_invite_test'));
  await Promise.all(MODELS.map((m) => m.syncIndexes()));
});

afterEach(async () => {
  await Promise.all(MODELS.map((m) => m.deleteMany({})));
  outbox.length = 0;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

/* ---------------------------------------------------------- helpers */

let n = 0;
// A clinic owner (Free plan unless told otherwise) with API helpers.
async function clinic(plan = 'free') {
  n += 1;
  const res = await request(app).post('/api/auth/signup').send({
    name: 'Meera', email: `owner${n}@test.example`, password: 'Sunrise#2024', businessName: `Clinic ${n}`, businessType: 'clinic', terms: true,
  });
  const business = await Business.findByIdAndUpdate(res.body.business.id, { plan }, { returnDocument: 'after' });
  const [doctor] = await Resource.find({ businessId: business._id });
  const auth = `Bearer ${res.body.accessToken}`;
  return {
    business,
    doctor,
    ownerEmail: `owner${n}@test.example`,
    invite: (body) => request(app).post('/api/admin/invites').set('Authorization', auth).send({ role: 'staff', resourceId: doctor.id, ...body }),
    resend: (id) => request(app).post(`/api/admin/invites/${id}/resend`).set('Authorization', auth),
    revoke: (id) => request(app).post(`/api/admin/invites/${id}/revoke`).set('Authorization', auth),
    list: () => request(app).get('/api/admin/staff').set('Authorization', auth),
  };
}

const tokenOf = (link) => link.split('/accept-invite/')[1];
const describe_ = (token) => request(app).get(`/api/invites/${token}`);
const accept = (token, body = {}) =>
  request(app).post(`/api/invites/${token}/accept`).send({ name: 'Rohan Iyer', password: 'Welcome#123', confirm: 'Welcome#123', ...body });

/* -------------------------------------------- Step 11.1: seat counting */

describe('seats', () => {
  test('the seat limit blocks a second invite on the Free plan (1 seat)', async () => {
    const c = await clinic('free');
    expect((await c.invite({ email: 'first@test.example' })).status).toBe(201);
    const second = await c.invite({ email: 'second@test.example' });
    expect(second.status).toBe(403);
    expect(second.body.error).toMatchObject({ code: 'seat_limit', details: { limitKey: 'staffSeats', used: 1, limit: 1 } });
  });

  test('active staff and pending invites use seats; the owner, expired, and revoked invites do not', async () => {
    const c = await clinic('pro'); // 3 seats
    await User.create({ name: 'Staff', email: 'active@test.example', passwordHash: 'x', role: 'staff', businessId: c.business._id });
    await User.create({ name: 'Gone', email: 'gone@test.example', passwordHash: 'x', role: 'staff', businessId: c.business._id, status: 'deactivated' });
    const pending = (await c.invite({ email: 'pending@test.example' })).body.invite;
    const expired = (await c.invite({ email: 'expired@test.example' })).body.invite;
    await StaffInvite.updateOne({ _id: expired.id }, { expiresAt: new Date(Date.now() - 1000) });

    expect((await c.list()).body.seats).toEqual({ used: 2, limit: 3 }); // active staff + pending invite
    expect((await c.invite({ email: 'third@test.example' })).status).toBe(201); // 3 of 3
    expect((await c.invite({ email: 'fourth@test.example' })).body.error.code).toBe('seat_limit');

    await c.revoke(pending.id); // frees a seat
    expect((await c.invite({ email: 'fourth@test.example' })).status).toBe(201);
  });
});

/* ------------------------------------------------- Step 11.2: invites */

describe('creating invites', () => {
  test('emails a link, stores only its hash, and returns the link outside production', async () => {
    const c = await clinic();
    const res = await c.invite({ email: '  Rohan@Test.example ' });
    expect(res.status).toBe(201);
    expect(res.body.invite).toMatchObject({ email: 'rohan@test.example', role: 'staff', status: 'invited', resourceId: c.doctor.id });

    const token = tokenOf(res.body.devInviteLink);
    expect(token).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(res.body.devInviteLink).toBe(`http://localhost:5173/accept-invite/${token}`);
    const saved = await StaffInvite.findById(res.body.invite.id);
    expect(saved.tokenHash).toBe(crypto.createHash('sha256').update(token).digest('hex'));
    expect(JSON.stringify(saved.toJSON())).not.toContain(token);

    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({ to: 'rohan@test.example', subject: `Join ${c.business.name} on QueueLess` });
    expect(outbox[0].text).toContain(res.body.devInviteLink);
    const days = (saved.expiresAt - Date.now()) / 86400000;
    expect(days).toBeGreaterThan(6.99);
    expect(days).toBeLessThanOrEqual(7);
  });

  test('refuses existing accounts, duplicate pending invites, and resources of other businesses', async () => {
    const c = await clinic('pro');
    const other = await clinic('pro');
    expect((await c.invite({ email: other.ownerEmail })).body.error.code).toBe('EMAIL_TAKEN'); // any business's account
    await c.invite({ email: 'dup@test.example' });
    expect((await c.invite({ email: 'dup@test.example' })).body.error.code).toBe('INVITE_PENDING');
    expect((await c.invite({ email: 'x@test.example', resourceId: other.doctor.id })).status).toBe(404);
    expect((await c.invite({ email: 'bad', role: 'owner' })).status).toBe(400);
  });

  test('inviting someone again after an expired or revoked invite reuses it (one row in the list)', async () => {
    const c = await clinic('pro');
    const first = (await c.invite({ email: 'again@test.example' })).body.invite;
    await c.revoke(first.id);
    const second = await c.invite({ email: 'again@test.example', role: 'manager' });
    expect(second.status).toBe(201);
    expect(second.body.invite).toMatchObject({ id: first.id, role: 'manager', status: 'invited' });
    expect(await StaffInvite.countDocuments({ email: 'again@test.example' })).toBe(1);
  });
});

describe('listing staff', () => {
  test('shows staff and invites with their status and days left', async () => {
    const c = await clinic('business'); // 15 seats: room for everyone below
    await User.create({ name: 'Priya', email: 'priya@test.example', passwordHash: 'x', role: 'staff', businessId: c.business._id, resourceId: c.doctor._id, lastLoginAt: new Date() });
    const fresh = (await c.invite({ email: 'fresh@test.example' })).body.invite;
    const soon = (await c.invite({ email: 'soon@test.example' })).body.invite;
    await StaffInvite.updateOne({ _id: soon.id }, { expiresAt: new Date(Date.now() + 20 * 3600000) });
    const revoked = (await c.invite({ email: 'revoked@test.example' })).body.invite;
    await c.revoke(revoked.id);

    const res = await c.list();
    expect(res.status).toBe(200);
    const byEmail = Object.fromEntries(res.body.staff.map((row) => [row.email, row]));
    expect(byEmail['priya@test.example']).toMatchObject({ kind: 'user', status: 'active', resource: { name: 'Dr. First doctor' } });
    expect(byEmail['fresh@test.example']).toMatchObject({ kind: 'invite', status: 'invited', daysLeft: 7 });
    expect(byEmail['soon@test.example']).toMatchObject({ status: 'invited', daysLeft: 1 });
    expect(byEmail['revoked@test.example']).toMatchObject({ status: 'revoked', daysLeft: 0 });
    expect(byEmail[fresh.email]).toBeDefined();
    expect(res.body.staff.some((row) => row.role === 'owner')).toBe(false);
  });

  test("staff cannot see the staff list, and an owner never sees another business's invites", async () => {
    const a = await clinic('pro');
    const b = await clinic('pro');
    const bInvite = (await b.invite({ email: 'b-person@test.example' })).body.invite;
    expect((await a.list()).body.staff.map((r) => r.email)).not.toContain('b-person@test.example');
    expect((await a.revoke(bInvite.id)).status).toBe(404);
    expect((await a.resend(bInvite.id)).status).toBe(404);

    const staff = await User.create({ name: 'S', email: 's@test.example', passwordHash: 'x', role: 'staff', businessId: a.business._id });
    const res = await request(app).get('/api/admin/staff').set('Authorization', `Bearer ${issueTokens(staff).accessToken}`);
    expect(res.status).toBe(403);
  });
});

describe('accepting invites', () => {
  test('the invite page shows the business, the role, and the resource', async () => {
    const c = await clinic();
    const token = tokenOf((await c.invite({ email: 'rohan@test.example' })).body.devInviteLink);
    const res = await describe_(token);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ business: { name: c.business.name }, email: 'rohan@test.example', role: 'staff', resource: { name: 'Dr. First doctor', label: 'Doctor' } });
  });

  test('accepting creates a staff user who is logged in and can log in again at /api/auth/login', async () => {
    const c = await clinic();
    const token = tokenOf((await c.invite({ email: 'rohan@test.example' })).body.devInviteLink);
    const res = await accept(token, { pin: '4321' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ user: { email: 'rohan@test.example', role: 'staff', businessId: String(c.business._id), resourceId: c.doctor.id }, home: '/staff' });
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.headers['set-cookie'].some((cookie) => cookie.startsWith('ql_refresh='))).toBe(true);
    expect(res.body.generatedPin).toBeUndefined();

    const user = await User.findOne({ email: 'rohan@test.example' });
    expect(await bcrypt.compare('4321', user.pinHash)).toBe(true);
    expect((await StaffInvite.findOne({ email: 'rohan@test.example' })).status).toBe('accepted');

    const login = await request(app).post('/api/auth/login').send({ email: 'rohan@test.example', password: 'Welcome#123' });
    expect([login.status, login.body.home]).toEqual([200, '/staff']);
  });

  test('without a chosen PIN, a random one is made and shown once', async () => {
    const c = await clinic();
    const token = tokenOf((await c.invite({ email: 'rohan@test.example' })).body.devInviteLink);
    const res = await accept(token);
    expect(res.body.generatedPin).toMatch(/^\d{4}$/);
    const user = await User.findOne({ email: 'rohan@test.example' });
    expect(await bcrypt.compare(res.body.generatedPin, user.pinHash)).toBe(true);
  });

  test('passwords must match and the PIN must be 4 digits', async () => {
    const c = await clinic();
    const token = tokenOf((await c.invite({ email: 'rohan@test.example' })).body.devInviteLink);
    const res = await accept(token, { confirm: 'Different#1', pin: '12' });
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field)).toEqual(expect.arrayContaining(['confirm', 'pin']));
    expect(await User.exists({ email: 'rohan@test.example' })).toBeNull();
  });

  test('used, revoked, expired, and replaced invite links return 410', async () => {
    const c = await clinic('pro');
    const used = tokenOf((await c.invite({ email: 'used@test.example' })).body.devInviteLink);
    await accept(used);

    const revokedInvite = await c.invite({ email: 'revoked@test.example' });
    await c.revoke(revokedInvite.body.invite.id);

    const expiredInvite = await c.invite({ email: 'expired@test.example' });
    await StaffInvite.updateOne({ _id: expiredInvite.body.invite.id }, { expiresAt: new Date(Date.now() - 1000) });

    const replacedInvite = await c.invite({ email: 'replaced@test.example' });
    const resent = await c.resend(replacedInvite.body.invite.id);
    expect(tokenOf(resent.body.devInviteLink)).not.toBe(tokenOf(replacedInvite.body.devInviteLink));

    for (const link of [used, tokenOf(revokedInvite.body.devInviteLink), tokenOf(expiredInvite.body.devInviteLink), tokenOf(replacedInvite.body.devInviteLink)]) {
      const page = await describe_(link);
      expect([page.status, page.body.error.message]).toEqual([410, 'This invite link is no longer valid']);
      expect((await accept(link, {})).status).toBe(410);
    }
    expect((await accept(tokenOf(resent.body.devInviteLink))).status).toBe(201); // the new link works
  });

  test('two "Create my account" clicks at the same moment create one account', async () => {
    const c = await clinic();
    const token = tokenOf((await c.invite({ email: 'rohan@test.example' })).body.devInviteLink);
    const results = await Promise.all([accept(token), accept(token), accept(token)]);
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(await User.countDocuments({ email: 'rohan@test.example' })).toBe(1);
  });

  test('resending an expired invite needs a free seat', async () => {
    const c = await clinic('free'); // 1 seat
    const old = (await c.invite({ email: 'old@test.example' })).body.invite;
    await StaffInvite.updateOne({ _id: old.id }, { expiresAt: new Date(Date.now() - 1000) }); // seat freed
    expect((await c.invite({ email: 'new@test.example' })).status).toBe(201); // seat taken again
    const res = await c.resend(old.id);
    expect(res.body.error.code).toBe('seat_limit');
  });
});

/* --------------------------------------------- Step 11.3: managing staff */

// A clinic with a staff member who accepted an invite (so they have a real password and PIN).
async function clinicWithStaff(plan = 'pro', email = 'rohan@test.example') {
  const c = await clinic(plan);
  const token = tokenOf((await c.invite({ email })).body.devInviteLink);
  const accepted = await accept(token, { pin: '1234' });
  const staff = await User.findOne({ email });
  const owner = await User.findOne({ businessId: c.business._id, role: 'owner' });
  const ownerAuth = `Bearer ${issueTokens(owner).accessToken}`;
  const admin = (method, path, body) => request(app)[method](`/api/admin/staff/${path}`).set('Authorization', ownerAuth).send(body);
  return { ...c, staff, staffAccess: accepted.body.accessToken, staffCookie: accepted.headers['set-cookie'][0].split(';')[0], admin };
}

describe('managing staff', () => {
  test('deactivated staff cannot log in, and every session they had ends at once', async () => {
    const c = await clinicWithStaff();
    const res = await c.admin('post', `${c.staff.id}/deactivate`);
    expect(res.body.user.status).toBe('deactivated');

    const login = await request(app).post('/api/auth/login').send({ email: 'rohan@test.example', password: 'Welcome#123' });
    expect([login.status, login.body.error.code]).toEqual([403, 'ACCOUNT_DEACTIVATED']);
    // Their old access token and refresh cookie stop working too.
    expect((await request(app).get('/api/staff/console').set('Authorization', `Bearer ${c.staffAccess}`)).status).toBe(401);
    expect((await request(app).post('/api/auth/refresh').set('Cookie', c.staffCookie)).status).toBe(401);
    // A deactivated person frees their seat.
    expect((await c.list()).body.seats.used).toBe(0);
  });

  test('reactivating needs a free seat', async () => {
    const c = await clinicWithStaff('free'); // 1 seat, used by Rohan
    await c.admin('post', `${c.staff.id}/deactivate`);
    expect((await c.invite({ email: 'other@test.example' })).status).toBe(201); // seat reused
    const res = await c.admin('post', `${c.staff.id}/reactivate`);
    expect(res.body.error.code).toBe('seat_limit');

    await Business.updateOne({ _id: c.business._id }, { plan: 'pro' });
    expect((await c.admin('post', `${c.staff.id}/reactivate`)).body.user.status).toBe('active');
  });

  test('the owner can change the resource and role, and reset a PIN (shown once)', async () => {
    const c = await clinicWithStaff();
    const second = await Resource.create({ businessId: c.business._id, name: 'Dr. Second', serviceIds: c.doctor.serviceIds });

    const moved = await c.admin('patch', c.staff.id, { resourceId: second.id, role: 'manager' });
    expect(moved.body.user).toMatchObject({ resourceId: second.id, role: 'manager' });
    expect((await c.admin('patch', c.staff.id, { resourceId: null })).body.user.resourceId).toBeNull();

    const reset = await c.admin('post', `${c.staff.id}/reset-pin`);
    expect(reset.body.pin).toMatch(/^\d{4}$/);
    expect(await bcrypt.compare(reset.body.pin, (await User.findById(c.staff._id)).pinHash)).toBe(true);
    expect(JSON.stringify(reset.body.user)).not.toContain('pinHash');
  });

  test("owners cannot be managed here, nor another business's staff", async () => {
    const a = await clinicWithStaff();
    const b = await clinic('pro');
    const ownerOfA = await User.findOne({ businessId: a.business._id, role: 'owner' });
    expect((await a.admin('post', `${ownerOfA.id}/deactivate`)).status).toBe(404);
    const otherOwner = await User.findOne({ businessId: b.business._id, role: 'owner' });
    const bAuth = `Bearer ${issueTokens(otherOwner).accessToken}`;
    expect((await request(app).post(`/api/admin/staff/${a.staff.id}/deactivate`).set('Authorization', bAuth)).status).toBe(404);
  });
});

/* ------------------------------------------------ Step 11.4: switching */

describe('PIN switching', () => {
  // The lockout lives in Redis (the local ql-redis container). Without Redis these tests
  // say so and pass on your computer, instead of failing for an unrelated reason. In CI
  // (GitHub sets CI=true) Redis is always provided, so a missing Redis is a real failure.
  let redisUp = false;
  let redis;
  beforeAll(async () => {
    ({ redis } = await import('../src/config/redis.js'));
    redisUp = await Promise.race([redis.ping().then(() => true, () => false), new Promise((r) => setTimeout(() => r(false), 1500))]);
    if (!redisUp && process.env.CI) throw new Error('Redis is not reachable in CI');
    if (!redisUp) console.warn('Redis is not reachable; skipping the PIN switching checks');
  });
  afterAll(async () => {
    if (redis) await redis.quit().catch(() => redis.disconnect());
  });

  // Rohan (PIN 1234) and Priya (PIN 5678) work at the same desk.
  async function frontDesk() {
    const c = await clinicWithStaff('pro');
    const token = tokenOf((await c.invite({ email: 'priya@test.example' })).body.devInviteLink);
    await accept(token, { name: 'Priya Sharma', pin: '5678' });
    const priya = await User.findOne({ email: 'priya@test.example' });
    const as = (access) => ({
      team: () => request(app).get('/api/staff/team').set('Authorization', `Bearer ${access}`),
      switchTo: (userId, pin) => request(app).post('/api/staff/switch-user').set('Authorization', `Bearer ${access}`).send({ userId, pin }),
    });
    return { ...c, priya, desk: as(c.staffAccess), as };
  }

  test('the team list shows names and colours only', async () => {
    if (!redisUp) return;
    const d = await frontDesk();
    const res = await d.desk.team();
    expect(res.status).toBe(200);
    expect(res.body.team.map((p) => p.name).sort()).toEqual(['Priya Sharma', 'Rohan Iyer']);
    expect(JSON.stringify(res.body)).not.toMatch(/@|pin|Hash/i);
  });

  test('the right PIN logs the other person in on this computer', async () => {
    if (!redisUp) return;
    const d = await frontDesk();
    const res = await d.desk.switchTo(d.priya.id, '5678');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ user: { email: 'priya@test.example' }, home: '/staff' });
    expect(res.headers['set-cookie'].some((cookie) => cookie.startsWith('ql_refresh='))).toBe(true);
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${res.body.accessToken}`);
    expect(me.body.user.name).toBe('Priya Sharma');
  });

  test('5 wrong PINs lock switching for 30 seconds, then it unlocks', async () => {
    if (!redisUp) return;
    const d = await frontDesk();

    for (const remaining of [4, 3, 2, 1]) {
      const wrong = await d.desk.switchTo(d.priya.id, '0000');
      expect([wrong.status, wrong.body.error.code, wrong.body.error.details.remaining]).toEqual([400, 'wrong_pin', remaining]);
    }
    const fifth = await d.desk.switchTo(d.priya.id, '0000');
    expect([fifth.status, fifth.body.error.code, fifth.body.error.details.secondsLeft]).toEqual([423, 'locked', 30]);

    // While locked, even the right PIN is refused, with the seconds left.
    const locked = await d.desk.switchTo(d.priya.id, '5678');
    expect(locked.status).toBe(423);
    expect(locked.body.error.details.secondsLeft).toBeGreaterThan(25);

    // Fast-forward: let the 30-second lock expire (shortened to 50 ms in Redis).
    await redis.pexpire(`pinlock:${d.business._id}`, 50);
    await new Promise((r) => setTimeout(r, 120));
    expect((await d.desk.switchTo(d.priya.id, '5678')).status).toBe(200);

    // After a success, the count starts again from 5.
    expect((await d.desk.switchTo(d.priya.id, '0000')).body.error.details.remaining).toBe(4);
  });

  test("only staff of the same business can be picked, and owners do not switch here", async () => {
    if (!redisUp) return;
    const d = await frontDesk();
    const other = await clinicWithStaff('pro', 'outsider@test.example'); // staff of a different business
    const owner = await User.findOne({ businessId: d.business._id, role: 'owner' });

    const outsider = await d.desk.switchTo(other.staff.id, '1234');
    expect(outsider.status).toBe(404);
    expect((await d.desk.switchTo(owner.id, '1111')).status).toBe(404);

    const asOwner = await request(app).post('/api/staff/switch-user').set('Authorization', `Bearer ${issueTokens(owner).accessToken}`).send({ userId: d.priya.id, pin: '5678' });
    expect(asOwner.status).toBe(403);

    await User.updateOne({ _id: d.priya._id }, { status: 'deactivated' });
    expect((await d.desk.switchTo(d.priya.id, '5678')).status).toBe(404);
  });
});
