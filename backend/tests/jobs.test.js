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
import { Notification } from '../src/models/Notification.js';
import { notificationsIdle } from '../src/services/notification.service.js';
import { dateKey } from '../src/utils/tokenNumber.js';
import { runNoShowJob } from '../src/jobs/noShow.job.js';
import { runInviteReminders, runDailySummaries } from '../src/jobs/reminder.job.js';
import { runCleanup } from '../src/jobs/cleanup.job.js';

const MODELS = [User, Business, Service, Resource, Token, Queue, ActivityLog, StaffInvite, Notification];
const HOUR = 3600000;
const DAY = 24 * HOUR;
let mongo;

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await mongoose.connect(mongo.getUri('queueless_jobs_test'));
  await Promise.all(MODELS.map((m) => m.syncIndexes()));
});

afterEach(async () => {
  await notificationsIdle();
  await Promise.all(MODELS.map((m) => m.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

/* ---------------------------------------------------------- helpers */

let n = 0;
async function business(extra = {}) {
  n += 1;
  const res = await request(app).post('/api/auth/signup').send({
    name: 'Meera', email: `owner${n}@test.example`, password: 'Sunrise#2024', businessName: `Canteen ${n}`, businessType: 'canteen', terms: true,
  });
  const businessId = res.body.business.id;
  await Business.updateOne({ _id: businessId }, { isLive: true, ...extra });
  const [service] = await Service.find({ businessId });
  const [counter] = await Resource.find({ businessId });
  return { businessId, service, counter, reload: () => Business.findById(businessId) };
}

let seq = 0;
async function token(b, { status = 'WAITING', day, createdAt = new Date(), calledAt = null, phone }) {
  seq += 1;
  const doc = new Token({
    businessId: b.businessId, queueKey: 'all', number: seq, code: `A-${String(seq).padStart(3, '0')}`, day,
    serviceId: b.service._id, resourceId: calledAt ? b.counter._id : null,
    customer: { name: 'Kiran Rao', phone: phone ?? String(9200000000 + seq) },
    status, calledAt, guestSecretHash: 'x',
  }).toObject({ transform: false });
  if (['WAITING', 'CALLED', 'SERVING'].includes(status)) doc.activePhone = doc.customer.phone;
  doc.createdAt = createdAt;
  await Token.collection.insertOne(doc);
  return doc._id;
}
const statusOf = async (id) => (await Token.findById(id)).status;

/* ---------------------------------------------------------- cleanup */

describe('nightly cleanup', () => {
  test("cancels yesterday's leftover tokens and frees their phones", async () => {
    const b = await business();
    const now = new Date('2026-10-28T21:40:00Z'); // 03:10 on the 29th in India
    const waiting = await token(b, { day: '2026-10-28', phone: '9876500001' });
    const called = await token(b, { status: 'CALLED', day: '2026-10-28', calledAt: new Date('2026-10-28T12:00:00Z') });
    const served = await token(b, { status: 'DONE', day: '2026-10-28' });
    const today = await token(b, { day: '2026-10-29' }); // joined after midnight: kept

    const result = await runCleanup(now);
    expect(result.leftoverTokensCancelled).toBe(2);

    const left = await Token.findById(waiting).lean();
    expect(left).toMatchObject({ status: 'CANCELLED', cancelledBy: 'system', cancelledAt: now });
    expect(left.activePhone).toBeUndefined();
    expect(await statusOf(called)).toBe('CANCELLED');
    expect(await statusOf(served)).toBe('DONE');
    expect(await statusOf(today)).toBe('WAITING');

    // The freed phone can be in line again (the one-active-token-per-phone rule passes).
    await expect(token(b, { day: '2026-10-29', phone: '9876500001' })).resolves.toBeDefined();
    expect((await runCleanup(now)).leftoverTokensCancelled).toBe(0); // nothing left the second time
  });

  test("uses each business's own date", async () => {
    const india = await business();
    const london = await business({ timeZone: 'Europe/London' });
    const now = new Date('2026-10-28T20:00:00Z'); // 01:30 on the 29th in India, still the 28th in London
    const a = await token(india, { day: '2026-10-28' });
    const b = await token(london, { day: '2026-10-28' });
    await runCleanup(now);
    expect(await statusOf(a)).toBe('CANCELLED');
    expect(await statusOf(b)).toBe('WAITING');
  });

  test('removes phone numbers after 90 days, keeping the history', async () => {
    const b = await business();
    const now = new Date();
    const old = await token(b, { status: 'DONE', day: '2026-07-01', createdAt: new Date(now - 91 * DAY) });
    const recent = await token(b, { status: 'DONE', day: '2026-10-01', createdAt: new Date(now - 30 * DAY) });

    expect((await runCleanup(now)).phonesRemoved).toBe(1);
    const gone = await Token.findById(old).lean();
    expect(gone.customer).toEqual({ name: 'Kiran Rao', phone: null });
    expect(gone.status).toBe('DONE');
    expect((await Token.findById(recent)).customer.phone).toMatch(/^\d{10}$/);
  });

  test('resets SMS credits once per month', async () => {
    const b = await business({ smsUsed: 42, smsMonth: '2026-09' });
    const now = new Date('2026-10-01T00:00:00Z'); // 05:30 on 1 October in India
    await runCleanup(now);
    expect(await b.reload()).toMatchObject({ smsUsed: 0, smsMonth: '2026-10' });

    await Business.updateOne({ _id: b.businessId }, { smsUsed: 7 }); // sent during October
    await runCleanup(new Date('2026-10-02T00:00:00Z'));
    expect((await b.reload()).smsUsed).toBe(7);
  });
});

/* ---------------------------------------------------------- no-shows */

describe('automatic no-shows', () => {
  test('marks customers called longer ago than noShowMinutes, only where turned on', async () => {
    const on = await business({ 'settings.autoNoShow': true, 'settings.noShowMinutes': 5 });
    const off = await business();
    const now = new Date();
    const late = await token(on, { status: 'CALLED', day: dateKey(now), calledAt: new Date(now - 6 * 60000) });
    const fresh = await token(on, { status: 'CALLED', day: dateKey(now), calledAt: new Date(now - 2 * 60000) });
    const elsewhere = await token(off, { status: 'CALLED', day: dateKey(now), calledAt: new Date(now - 20 * 60000) });

    expect(await runNoShowJob(now)).toEqual({ marked: 1 });
    const marked = await Token.findById(late).lean();
    expect(marked.status).toBe('NO_SHOW');
    expect(marked.activePhone).toBeUndefined();
    expect(await statusOf(fresh)).toBe('CALLED');
    expect(await statusOf(elsewhere)).toBe('CALLED');
    expect(await runNoShowJob(now)).toEqual({ marked: 0 });
  });
});

/* ---------------------------------------------------------- reminders */

describe('reminders', () => {
  const invite = (b, expiresAt, extra = {}) => StaffInvite.create({
    businessId: b.businessId, email: `staff${(seq += 1)}@test.example`, tokenHash: `hash${seq}`, expiresAt, ...extra,
  });

  test('warns about an invite expiring within a day, once', async () => {
    const b = await business();
    const now = new Date();
    const soon = await invite(b, new Date(now.getTime() + 5 * HOUR));
    await invite(b, new Date(now.getTime() + 3 * DAY)); // not yet
    await invite(b, new Date(now.getTime() + 2 * HOUR), { status: 'accepted' }); // already used
    await invite(b, new Date(now.getTime() - HOUR)); // already expired

    expect(await runInviteReminders(now)).toEqual({ sent: 1 });
    expect(await runInviteReminders(new Date(now.getTime() + 60000))).toEqual({ sent: 0 });

    const notes = await Notification.find({ businessId: b.businessId, kind: 'invite_expiring' });
    expect(notes).toHaveLength(1);
    expect(notes[0].body).toBe(`The invite for ${soon.email} expires in 5 hours. Resend it if they still need it.`);

    // Resending moves the expiry: that link gets its own reminder when it is close.
    await StaffInvite.updateOne({ _id: soon._id }, { expiresAt: new Date(now.getTime() + 20 * HOUR) });
    expect(await runInviteReminders(now)).toEqual({ sent: 1 });
  });

  test("sends yesterday's summary once, and only when there was something", async () => {
    const busy = await business();
    const quiet = await business();
    const muted = await business({ 'notifications.dailySummary': false });
    const now = new Date('2026-10-29T02:30:00Z'); // 08:00 on the 29th in India
    await token(busy, { status: 'DONE', day: '2026-10-28', createdAt: new Date('2026-10-28T05:00:00Z'), calledAt: new Date('2026-10-28T05:12:00Z') });
    await token(busy, { status: 'NO_SHOW', day: '2026-10-28', createdAt: new Date('2026-10-28T06:00:00Z'), calledAt: new Date('2026-10-28T06:08:00Z') });
    await Token.updateMany({ businessId: busy.businessId }, { doneAt: new Date('2026-10-28T07:00:00Z') });
    await token(muted, { status: 'DONE', day: '2026-10-28', createdAt: new Date('2026-10-28T05:00:00Z') });

    expect(await runDailySummaries(now)).toEqual({ sent: 1 });
    expect(await runDailySummaries(now)).toEqual({ sent: 0 });

    const [note] = await Notification.find({ businessId: busy.businessId, kind: 'daily_summary' });
    expect(note.body).toBe('2 tokens, 1 served, 1 no-shows, average wait 10 min.');
    expect(await Notification.countDocuments({ businessId: { $in: [quiet.businessId, muted.businessId] } })).toBe(0);
  });
});
