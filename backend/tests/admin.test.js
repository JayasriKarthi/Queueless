import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import app from '../app.js';
import { User } from '../src/models/User.js';
import { Business } from '../src/models/Business.js';
import { Service } from '../src/models/Service.js';
import { Resource } from '../src/models/Resource.js';
import { Token } from '../src/models/Token.js';
import { ActivityLog } from '../src/models/ActivityLog.js';

const MODELS = [User, Business, Service, Resource, Token, ActivityLog];
let mongo;

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await mongoose.connect(mongo.getUri('queueless_admin_test'));
  await Promise.all(MODELS.map((m) => m.syncIndexes()));
});

afterEach(() => Promise.all(MODELS.map((m) => m.deleteMany({}))));

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

/* ---------------------------------------------------------- helpers */

// A Free bank from the template: 3 services, 1 active counter that handles all of them.
async function createBank(email = 'owner@test.example') {
  const res = await request(app).post('/api/auth/signup').send({
    name: 'Owner', email, password: 'Sunrise#2024', businessName: 'Test Bank', businessType: 'bank', terms: true,
  });
  const auth = `Bearer ${res.body.accessToken}`;
  const api = {
    get: (path) => request(app).get(`/api/admin${path}`).set('Authorization', auth),
    post: (path, body) => request(app).post(`/api/admin${path}`).set('Authorization', auth).send(body),
    patch: (path, body) => request(app).patch(`/api/admin${path}`).set('Authorization', auth).send(body),
    delete: (path) => request(app).delete(`/api/admin${path}`).set('Authorization', auth),
  };
  const businessId = res.body.business.id;
  const services = await Service.find({ businessId }).sort({ sortOrder: 1 });
  const [counter] = await Resource.find({ businessId });
  return { api, businessId, services, counter };
}

const waitingToken = (businessId, serviceId, n = 1) =>
  Token.create({
    businessId, queueKey: `svc:${serviceId}`, number: n, code: `C-00${n}`, serviceId,
    customer: { name: 'Kiran Rao', phone: '9876543210' }, guestSecretHash: 'x',
  });

/* ---------------------------------------------------- plan limits */

describe('plan limits (Done when #1 and #2)', () => {
  test('a Free business with 1 active counter gets PLAN_LIMIT when adding a second', async () => {
    const { api, services } = await createBank();
    const res = await api.post('/resources', { name: 'Counter 2', serviceIds: [services[0].id] });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatchObject({ code: 'PLAN_LIMIT', details: { limitKey: 'counters', used: 1, limit: 1 } });
    expect(await Resource.countDocuments()).toBe(1);
  });

  test('an inactive counter can be added, but switching it on hits the limit (single and bulk)', async () => {
    const { api, services } = await createBank();
    const created = await api.post('/resources', { name: 'Counter 2', serviceIds: [services[0].id], isActive: false });
    expect(created.status).toBe(201);

    const single = await api.patch(`/resources/${created.body.resource.id}`, { isActive: true });
    expect(single.status).toBe(403);
    const bulk = await api.post('/resources/bulk', { ids: [created.body.resource.id], action: 'activate' });
    expect(bulk.status).toBe(403);
    expect(bulk.body.error.code).toBe('PLAN_LIMIT');
  });

  test('the same business can still edit and rename its existing counters', async () => {
    const { api, counter } = await createBank();
    const res = await api.patch(`/resources/${counter.id}`, { name: 'Front desk', isPaused: true });
    expect(res.status).toBe(200);
    expect(res.body.resource).toMatchObject({ name: 'Front desk', isPaused: true, isActive: true });
  });

  test('after a downgrade, nothing is removed and everything stays editable', async () => {
    const { api, businessId, services, counter } = await createBank();
    await Business.updateOne({ _id: businessId }, { plan: 'pro' });
    const c2 = await api.post('/resources', { name: 'Counter 2', serviceIds: [services[0].id] });
    const c3 = await api.post('/resources', { name: 'Counter 3', serviceIds: [services[0].id] });
    expect([c2.status, c3.status]).toEqual([201, 201]);

    await Business.updateOne({ _id: businessId }, { plan: 'free' }); // now 3 active, limit 1
    expect(await Resource.countDocuments({ businessId, isActive: true })).toBe(3);
    expect((await api.patch(`/resources/${counter.id}`, { name: 'Renamed' })).status).toBe(200);
    expect((await api.post('/resources/bulk', { ids: [c2.body.resource.id, c3.body.resource.id], action: 'deactivate' })).status).toBe(200);
    // Back to 1 active: switching another on is still blocked.
    expect((await api.patch(`/resources/${c2.body.resource.id}`, { isActive: true })).status).toBe(403);
  });
});

/* ------------------------------------------------- deleting the last */

describe('deleting (Done when #3)', () => {
  test('deleting the last service returns a clear 400', async () => {
    const { api, services } = await createBank();
    const bulk = await api.post('/services/bulk', { ids: [services[1].id, services[2].id], action: 'delete' });
    expect(bulk.status).toBe(200);
    const res = await api.delete(`/services/${services[0].id}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: 'LAST_SERVICE', message: 'Keep at least one service so customers can join.' });
  });

  test('deleting the last resource returns a clear 400', async () => {
    const { api, counter } = await createBank();
    const res = await api.delete(`/resources/${counter.id}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: 'LAST_RESOURCE', message: 'Keep at least one counter to serve customers.' });
  });

  test('a service with people waiting cannot be deleted (409), and past tokens keep their serviceId', async () => {
    const { api, businessId, services } = await createBank();
    const token = await waitingToken(businessId, services[1]._id);
    const res = await api.delete(`/services/${services[1].id}`);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: 'SERVICE_IN_USE', details: { count: 1 } });

    await Token.updateOne({ _id: token._id }, { status: 'DONE' });
    expect((await api.delete(`/services/${services[1].id}`)).status).toBe(200);
    expect(String((await Token.findById(token._id)).serviceId)).toBe(services[1].id);
  });

  test('deleting a resource unassigns its staff', async () => {
    const { api, businessId, services, counter } = await createBank();
    await Business.updateOne({ _id: businessId }, { plan: 'pro' });
    const c2 = await api.post('/resources', { name: 'Counter 2', serviceIds: [services[0].id] });
    const staff = await User.create({ name: 'Staff', email: 's@test.example', passwordHash: 'x', role: 'staff', businessId, resourceId: c2.body.resource.id });
    expect((await api.delete(`/resources/${c2.body.resource.id}`)).status).toBe(200);
    expect((await User.findById(staff._id)).resourceId).toBeNull();
    expect(await Resource.exists({ _id: counter._id })).toBeTruthy();
  });
});

/* ---------------------------------------------------------- services */

describe('services', () => {
  test('lists services with who handles them and how many are waiting, with filters', async () => {
    const { api, businessId, services, counter } = await createBank();
    await waitingToken(businessId, services[0]._id, 1);
    await waitingToken(businessId, services[0]._id, 2);
    await api.patch(`/services/${services[2].id}`, { isActive: false });

    const all = await api.get('/services');
    expect(all.status).toBe(200);
    expect(all.body.services).toHaveLength(3);
    expect(all.body.services[0]).toMatchObject({ name: 'Cash deposit and withdrawal', waiting: 2, handledBy: [{ id: counter.id, name: 'Counter 1' }] });

    expect((await api.get('/services?status=inactive')).body.services.map((s) => s.name)).toEqual(['Loans']);
    expect((await api.get('/services?q=kyc')).body.services.map((s) => s.name)).toEqual(['Accounts and KYC']);
  });

  test('creating a service adds it to the chosen resources, and the prefix is uppercased', async () => {
    const { api, counter } = await createBank();
    const res = await api.post('/services', { name: 'Forex', avgMinutes: 15, prefix: 'f', handledBy: [counter.id] });
    expect(res.status).toBe(201);
    expect(res.body.service).toMatchObject({ name: 'Forex', prefix: 'F', isActive: true, sortOrder: 3 });
    const updated = await Resource.findById(counter._id);
    expect(updated.serviceIds.map(String)).toContain(res.body.service.id);
  });

  test('changing handledBy never leaves a resource with no services', async () => {
    const { api, businessId, services } = await createBank();
    await Business.updateOne({ _id: businessId }, { plan: 'pro' });
    const forex = await api.post('/services', { name: 'Forex', avgMinutes: 15, prefix: 'F' });
    const desk = await api.post('/resources', { name: 'Forex desk', serviceIds: [forex.body.service.id] });

    const res = await api.patch(`/services/${forex.body.service.id}`, { handledBy: [] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: 'RESOURCE_NEEDS_SERVICE', details: { resources: [{ id: desk.body.resource.id, name: 'Forex desk' }] } });

    // Moving it is fine once the desk has another service.
    await api.patch(`/resources/${desk.body.resource.id}`, { serviceIds: [forex.body.service.id, services[0].id] });
    expect((await api.patch(`/services/${forex.body.service.id}`, { handledBy: [] })).status).toBe(200);
  });

  test('invalid input is refused with field messages', async () => {
    const { api } = await createBank();
    const res = await api.post('/services', { name: '', avgMinutes: 0, prefix: 'ABC', handledBy: ['nope'] });
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field)).toEqual(expect.arrayContaining(['name', 'avgMinutes', 'prefix', 'handledBy.0']));
  });
});

/* --------------------------------------------------------- resources */

describe('resources', () => {
  test('lists resources with assigned staff, the current token, and the waiting count', async () => {
    const { api, businessId, services, counter } = await createBank();
    await User.create({ name: 'Priya', email: 'p@test.example', passwordHash: 'x', role: 'staff', businessId, resourceId: counter._id });
    await waitingToken(businessId, services[0]._id, 1);
    const called = await waitingToken(businessId, services[1]._id, 2);
    await Token.updateOne({ _id: called._id }, { status: 'CALLED', resourceId: counter._id, calledAt: new Date() });

    const res = await api.get('/resources');
    expect(res.status).toBe(200);
    expect(res.body.resources[0]).toMatchObject({ name: 'Counter 1', staff: [{ name: 'Priya' }], current: { code: 'C-002', status: 'CALLED' }, waiting: 1 });
  });

  test("another business's resource is not found", async () => {
    const a = await createBank('a@test.example');
    const b = await createBank('b@test.example');
    expect((await a.api.patch(`/resources/${b.counter.id}`, { name: 'Hijacked' })).status).toBe(404);
    expect((await a.api.post('/resources', { name: 'X', serviceIds: [b.services[0].id], isActive: false })).status).toBe(404);
  });

  test('staff cannot use the admin routes', async () => {
    const { businessId } = await createBank();
    const owner = await User.findOne({ role: 'owner' });
    await User.create({ name: 'Staff', email: 'staff@test.example', passwordHash: owner.passwordHash, role: 'staff', businessId });
    const login = await request(app).post('/api/auth/login').send({ email: 'staff@test.example', password: 'Sunrise#2024' });
    const res = await request(app).get('/api/admin/services').set('Authorization', `Bearer ${login.body.accessToken}`);
    expect(res.status).toBe(403);
  });
});
