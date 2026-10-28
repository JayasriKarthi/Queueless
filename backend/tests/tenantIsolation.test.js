import express from 'express';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { requireAuth } from '../src/middleware/auth.middleware.js';
import { tenantScope } from '../src/middleware/tenant.middleware.js';
import { errorMiddleware } from '../src/middleware/error.middleware.js';
import { scoped, assertCanUseResource } from '../src/services/tenant.service.js';
import { issueTokens } from '../src/services/auth.service.js';
import { User } from '../src/models/User.js';
import { Business } from '../src/models/Business.js';
import { Service } from '../src/models/Service.js';
import { Resource } from '../src/models/Resource.js';
import { Token } from '../src/models/Token.js';
import { StaffInvite } from '../src/models/StaffInvite.js';
import { Invoice } from '../src/models/Invoice.js';
import { SlugHistory } from '../src/models/SlugHistory.js';
import { STAFF_ROLES } from '../src/utils/constants.js';

// Business A must never read or change business B's data, and A's staff may only act on
// their assigned resource. The real admin and staff routes are built in Phases 7 to 13, so
// this suite uses a stand-in app wired exactly the way those routes are: requireAuth,
// tenantScope, then every query through scoped(). When the real routes exist, point the
// requests below at them and keep every assertion.

const COLLECTIONS = {
  services: { Model: Service },
  resources: { Model: Resource },
  staff: { Model: User, filter: { role: { $in: STAFF_ROLES } } },
  tokens: { Model: Token },
  invites: { Model: StaffInvite },
  invoices: { Model: Invoice },
};

function buildApp() {
  const app = express();
  app.use(express.json());
  const admin = [requireAuth, tenantScope];
  const collection = (req) => {
    const entry = COLLECTIONS[req.params.collection];
    if (!entry) throw Object.assign(new Error('Unknown collection'), { statusCode: 404 });
    return { ...entry, db: scoped(entry.Model, req.businessId) };
  };
  const notFound = (res) => res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Not found' } });

  app.get('/api/admin/:collection', admin, async (req, res) => {
    const { db, filter } = collection(req);
    const items = await db.find(filter ?? {});
    res.json({ ok: true, items: items.map((d) => ({ id: d.id, businessId: String(d.businessId) })) });
  });
  app.get('/api/admin/:collection/:id', admin, async (req, res) => {
    const item = await collection(req).db.findById(req.params.id);
    return item ? res.json({ ok: true, id: item.id }) : notFound(res);
  });
  app.patch('/api/admin/:collection/:id', admin, async (req, res) => {
    const result = await collection(req).db.updateOne({ _id: req.params.id }, { $set: { name: 'changed by another business' } });
    return result.matchedCount ? res.json({ ok: true }) : notFound(res);
  });
  app.delete('/api/admin/:collection/:id', admin, async (req, res) => {
    const result = await collection(req).db.deleteOne({ _id: req.params.id });
    return result.deletedCount ? res.json({ ok: true }) : notFound(res);
  });
  app.post('/api/staff/resources/:id/call-next', admin, async (req, res) => {
    const resource = await scoped(Resource, req.businessId).findById(req.params.id);
    if (!resource) return notFound(res);
    assertCanUseResource(req.user, resource._id);
    res.json({ ok: true, resource: resource.name });
  });

  app.use(errorMiddleware);
  return app;
}

/* -------------------------------------------------------------- seed */

const { ObjectId } = mongoose.Types;
let mongo;
let app;
const seed = {};

async function seedBusiness(key, slug) {
  const businessId = new ObjectId();
  const ownerId = new ObjectId();
  const business = await Business.create({ _id: businessId, name: `Business ${key}`, slug, type: 'bank', ownerId });
  const service = await Service.create({ businessId, name: `${key} cash`, avgMinutes: 5, prefix: 'C' });
  const [counter1, counter2] = await Resource.create([
    { businessId, name: `${key} counter 1`, serviceIds: [service._id] },
    { businessId, name: `${key} counter 2`, serviceIds: [service._id] },
  ]);
  const owner = await User.create({ _id: ownerId, name: `${key} owner`, email: `owner-${key}@test.example`, passwordHash: 'x', role: 'owner', businessId });
  const staff = await User.create({ name: `${key} staff`, email: `staff-${key}@test.example`, passwordHash: 'x', role: 'staff', businessId, resourceId: counter1._id });
  const token = await Token.create({
    businessId, queueKey: `svc:${service._id}`, number: 1, code: 'C-001', serviceId: service._id,
    customer: { name: 'Kiran Rao', phone: '9876543210' }, guestSecretHash: 'x',
  });
  const invite = await StaffInvite.create({ businessId, email: `new-${key}@test.example`, tokenHash: `hash-${key}`, expiresAt: new Date(Date.now() + 86400000) });
  const invoice = await Invoice.create({ businessId, number: `QL-${key}`, date: new Date(), plan: 'Pro (monthly)', amount: 99900, status: 'paid' });

  return {
    business, counter1, counter2,
    ids: { services: service.id, resources: counter1.id, staff: staff.id, tokens: token.id, invites: invite.id, invoices: invoice.id },
    ownerAuth: `Bearer ${issueTokens(owner).accessToken}`,
    staffAuth: `Bearer ${issueTokens(staff).accessToken}`,
  };
}

const countAll = () => Promise.all(Object.values(COLLECTIONS).map(({ Model }) => Model.countDocuments()));

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await mongoose.connect(mongo.getUri('queueless_tenant_test'));
  await Promise.all([User, Business, Service, Resource, Token, StaffInvite, Invoice, SlugHistory].map((m) => m.syncIndexes()));
  seed.A = await seedBusiness('A', 'alpha-bank');
  seed.B = await seedBusiness('B', 'beta-bank');
  app = buildApp();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

/* ------------------------------------------------------------- tests */

describe.each(Object.keys(COLLECTIONS))('%s', (collection) => {
  test("A's list contains only A's records", async () => {
    const res = await request(app).get(`/api/admin/${collection}`).set('Authorization', seed.A.ownerAuth);
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.items.every((item) => item.businessId === seed.A.business.id)).toBe(true);
    expect(res.body.items.map((item) => item.id)).not.toContain(seed.B.ids[collection]);
  });

  test("A cannot read, update, or delete B's record by id (404, so the id is not confirmed)", async () => {
    const before = await countAll();
    const path = `/api/admin/${collection}/${seed.B.ids[collection]}`;
    for (const method of ['get', 'patch', 'delete']) {
      const res = await request(app)[method](path).set('Authorization', seed.A.ownerAuth);
      expect(res.status).toBe(404);
    }
    expect(await countAll()).toEqual(before);
  });

  test("B can still read its own record (the 404s above were not a broken route)", async () => {
    const res = await request(app).get(`/api/admin/${collection}/${seed.B.ids[collection]}`).set('Authorization', seed.B.ownerAuth);
    expect(res.status).toBe(200);
  });
});

describe('cross-business requests', () => {
  test("A cannot call next on B's resource", async () => {
    const res = await request(app).post(`/api/staff/resources/${seed.B.counter1.id}/call-next`).set('Authorization', seed.A.ownerAuth);
    expect(res.status).toBe(404);
  });

  test("A's staff cannot call next on B's resource", async () => {
    const res = await request(app).post(`/api/staff/resources/${seed.B.counter1.id}/call-next`).set('Authorization', seed.A.staffAuth);
    expect(res.status).toBe(404);
  });

  test('passing ?business=<B slug> is refused with 403 ACCESS_DENIED', async () => {
    const res = await request(app).get('/api/admin/services?business=beta-bank').set('Authorization', seed.A.ownerAuth);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCESS_DENIED');
  });

  test("?business= with A's own slug, or one of A's old slugs, is allowed", async () => {
    await SlugHistory.create({ businessId: seed.A.business._id, slug: 'old-alpha', redirectUntil: new Date(Date.now() + 86400000) });
    for (const slug of ['alpha-bank', 'old-alpha']) {
      const res = await request(app).get(`/api/admin/services?business=${slug}`).set('Authorization', seed.A.ownerAuth);
      expect(res.status).toBe(200);
    }
  });

  test("a businessId for B in the request body is refused with 403", async () => {
    const res = await request(app)
      .patch(`/api/admin/services/${seed.A.ids.services}`)
      .set('Authorization', seed.A.ownerAuth)
      .send({ businessId: seed.B.business.id });
    expect(res.status).toBe(403);
  });

  test('scoped() refuses updates that would move a record to another business', async () => {
    const db = scoped(Service, seed.A.business._id);
    expect(() => db.updateOne({ _id: seed.A.ids.services }, { $set: { businessId: seed.B.business._id } })).toThrow('businessId cannot be changed');
  });
});

describe("staff limits inside their own business", () => {
  test('staff can act on their assigned resource', async () => {
    const res = await request(app).post(`/api/staff/resources/${seed.A.counter1.id}/call-next`).set('Authorization', seed.A.staffAuth);
    expect(res.status).toBe(200);
  });

  test("staff cannot act on another resource in their own business (403)", async () => {
    const res = await request(app).post(`/api/staff/resources/${seed.A.counter2.id}/call-next`).set('Authorization', seed.A.staffAuth);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCESS_DENIED');
  });

  test('the owner can act on any resource in their business', async () => {
    const res = await request(app).post(`/api/staff/resources/${seed.A.counter2.id}/call-next`).set('Authorization', seed.A.ownerAuth);
    expect(res.status).toBe(200);
  });
});
