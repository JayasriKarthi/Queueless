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
import { Notification } from '../src/models/Notification.js';
import { smsOutbox, notificationsIdle } from '../src/services/notification.service.js';
import { issueTokens } from '../src/services/auth.service.js';

const MODELS = [User, Business, Service, Resource, Token, Queue, ActivityLog, Notification];
let mongo;

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await mongoose.connect(mongo.getUri('queueless_notification_test'));
  await Promise.all(MODELS.map((m) => m.syncIndexes()));
});

afterEach(async () => {
  await notificationsIdle();
  await Promise.all(MODELS.map((m) => m.deleteMany({})));
  smsOutbox.length = 0;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

/* ---------------------------------------------------------- helpers */

let n = 0;
// A live canteen (one shared line, one counter) with the given plan and SMS setting.
async function canteen({ plan = 'pro', almostSms = true } = {}) {
  n += 1;
  const res = await request(app).post('/api/auth/signup').send({
    name: 'Meera', email: `owner${n}@test.example`, password: 'Sunrise#2024', businessName: `Canteen ${n}`, businessType: 'canteen', terms: true,
  });
  const businessId = res.body.business.id;
  await Business.updateOne({ _id: businessId }, { isLive: true, plan, 'notifications.almostSms': almostSms, 'settings.maxTokensPerDay': 500 });
  const [counter] = await Resource.find({ businessId });
  const auth = `Bearer ${res.body.accessToken}`;
  let phone = 9000000000 + n * 1000;
  return {
    businessId,
    auth,
    join: async (count = 1) => {
      for (let i = 0; i < count; i += 1) {
        await request(app).post(`/api/public/${res.body.business.slug}/tokens`).send({ customer: { name: 'Kiran Rao', phone: String((phone += 1)) } });
      }
      await notificationsIdle();
    },
    callNext: async () => {
      const r = await request(app).post(`/api/staff/resources/${counter.id}/call-next`).set('Authorization', auth);
      await notificationsIdle();
      return r.body.called;
    },
    alerted: async () => (await Token.find({ businessId, alertedAlmostAt: { $ne: null } }).sort({ number: 1 })).map((t) => t.code),
    smsTo: async (code) => {
      const token = await Token.findOne({ businessId, code });
      return smsOutbox.filter((m) => m.to === token.customer.phone).map((m) => m.text);
    },
    reload: () => Business.findById(businessId),
  };
}

/* ------------------------------------------------ almost your turn */

describe('"almost your turn"', () => {
  test('is sent once per token, when 3 or fewer people are ahead', async () => {
    const c = await canteen({ plan: 'free' });
    await c.join(6); // T-001 to T-006
    // Already near the front when they joined: marked, so nobody gets an alert seconds after joining.
    expect(await c.alerted()).toEqual(['T-001', 'T-002', 'T-003', 'T-004']);

    await c.callNext(); // T-005 is now 3rd in line
    expect(await c.alerted()).toEqual(['T-001', 'T-002', 'T-003', 'T-004', 'T-005']);
    await c.callNext(); // T-006 is now 3rd
    await c.callNext();
    await c.callNext();
    expect(await c.alerted()).toEqual(['T-001', 'T-002', 'T-003', 'T-004', 'T-005', 'T-006']);
  });

  test('on a paid plan with SMS on, the customer also gets a text (and one when called)', async () => {
    const c = await canteen({ plan: 'pro', almostSms: true });
    await c.join(5);
    expect(smsOutbox).toEqual([]); // nobody was texted just for joining

    await c.callNext(); // T-001 called; T-005 now has 3 ahead
    expect(await c.smsTo('T-005')).toEqual([expect.stringMatching(/: token T-005, 3 people ahead of you\. Please head back\.$/)]);
    expect(await c.smsTo('T-001')).toEqual([expect.stringMatching(/: it is your turn \(token T-001\)\. Please go to Counter 1\.$/)]);
    expect((await c.reload()).smsUsed).toBe(2);

    await c.callNext(); // a second line move: T-005 is not texted again
    expect(await c.smsTo('T-005')).toHaveLength(1);
  });

  test('no SMS on the Free plan, or when the owner has SMS alerts off', async () => {
    const free = await canteen({ plan: 'free', almostSms: true });
    await free.join(5);
    await free.callNext();
    const off = await canteen({ plan: 'pro', almostSms: false });
    await off.join(5);
    await off.callNext();

    expect(smsOutbox).toEqual([]);
    expect((await free.reload()).smsUsed).toBe(0);
    expect(await off.alerted()).toContain('T-005'); // the on-screen alert still happens
  });
});

/* ------------------------------------------------------ SMS credits */

describe('SMS credits', () => {
  test('warn when running low, then stop sending when used up, telling the owner once', async () => {
    const c = await canteen({ plan: 'pro' }); // 100 SMS a month
    await Business.updateOne({ _id: c.businessId }, { smsUsed: 98 });
    await c.join(8);

    await c.callNext(); // 2 texts: T-001 called, T-005 almost -> 100 of 100 used
    await c.callNext(); // T-002 called, T-006 almost: no credits left
    await c.callNext();

    expect((await c.reload()).smsUsed).toBe(100);
    expect(smsOutbox).toHaveLength(2);
    // (8 joins also report a long line; only the SMS notifications matter here.)
    const kinds = (await Notification.find({ businessId: c.businessId, kind: /^sms/ })).map((x) => x.kind).sort();
    expect(kinds).toEqual(['sms_low', 'sms_used_up']); // each only once, despite several attempts
  });
});

/* ------------------------------------------------ owner notifications */

describe('owner notifications', () => {
  test('a long line is reported once a day, not on every join', async () => {
    const c = await canteen();
    await c.join(7);
    expect(await Notification.countDocuments({ businessId: c.businessId })).toBe(0);
    await c.join(3); // 8, 9, 10 waiting
    const notes = await Notification.find({ businessId: c.businessId });
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ kind: 'long_line', title: 'Line is getting long', body: 'Your line has 8 people waiting.' });
  });

  test('the bell lists notifications with an unread count, and marks them read', async () => {
    const c = await canteen();
    await c.join(8);
    const bell = (method, path) => request(app)[method](`/api/admin/notifications${path}`).set('Authorization', c.auth);

    const list = await bell('get', '');
    expect(list.status).toBe(200);
    expect(list.body.unread).toBe(1);
    expect(list.body.notifications[0]).toMatchObject({ kind: 'long_line', read: false });

    expect((await bell('post', '/read')).body.marked).toBe(1);
    expect((await bell('get', '')).body.unread).toBe(0);
  });

  test("owners only see their own business's notifications; staff cannot open the bell", async () => {
    const a = await canteen();
    const b = await canteen();
    await a.join(8);
    const otherBell = await request(app).get('/api/admin/notifications').set('Authorization', b.auth);
    expect(otherBell.body).toMatchObject({ notifications: [], unread: 0 });

    const staff = await User.create({ name: 'S', email: `s${n}@test.example`, passwordHash: 'x', role: 'staff', businessId: a.businessId });
    const res = await request(app).get('/api/admin/notifications').set('Authorization', `Bearer ${issueTokens(staff).accessToken}`);
    expect(res.status).toBe(403);
  });
});
