import express from 'express';
import request from 'supertest';
import mongoose from 'mongoose';
import Stripe from 'stripe';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import app from '../app.js';
import { PLANS, getPlan, planPrice, planLimit, hasFeature, planForFeature, YEARLY_DISCOUNT } from '../src/utils/constants.js';
import { requireFeature } from '../src/middleware/planLimit.middleware.js';
import { errorMiddleware } from '../src/middleware/error.middleware.js';
import { setStripeClient } from '../src/services/billing.service.js';
import { issueTokens } from '../src/services/auth.service.js';
import { User } from '../src/models/User.js';
import { Business } from '../src/models/Business.js';
import { Service } from '../src/models/Service.js';
import { Resource } from '../src/models/Resource.js';
import { Token } from '../src/models/Token.js';
import { Queue } from '../src/models/Queue.js';
import { ActivityLog } from '../src/models/ActivityLog.js';
import { Subscription } from '../src/models/Subscription.js';
import { Invoice } from '../src/models/Invoice.js';
import { WebhookEvent } from '../src/models/WebhookEvent.js';

const MODELS = [User, Business, Service, Resource, Token, Queue, ActivityLog, Subscription, Invoice, WebhookEvent];
let mongo;

// A stand-in for the Stripe API client: records what would have been sent, charges nothing.
const stripeCalls = [];
const fakeStripe = {
  checkout: { sessions: { create: async (args) => { stripeCalls.push(['checkout', args]); return { id: `cs_test_${stripeCalls.length}`, url: 'https://checkout.stripe.com/c/pay/cs_test_example' }; } } },
  subscriptions: {
    update: async (id, args) => { stripeCalls.push(['update', id, args]); return { id }; },
    cancel: async (id) => { stripeCalls.push(['cancel', id]); return { id }; },
  },
};

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await mongoose.connect(mongo.getUri('queueless_billing_test'));
  await Promise.all(MODELS.map((m) => m.syncIndexes()));
});

beforeEach(() => {
  stripeCalls.length = 0;
  setStripeClient(fakeStripe);
});

afterEach(() => Promise.all(MODELS.map((m) => m.deleteMany({}))));

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

/* ------------------------------------- Step 13.1: plans as the source of truth */

describe('plans', () => {
  test("match the guide's table", () => {
    const table = PLANS.map((p) => ({
      id: p.id, price: p.priceMonthly, trial: p.trialDays,
      counters: p.limits.counters, tokens: p.limits.tokensPerDay, seats: p.limits.staffSeats,
    }));
    expect(table).toEqual([
      { id: 'free', price: 0, trial: 0, counters: 1, tokens: 50, seats: 1 },
      { id: 'pro', price: 999, trial: 14, counters: 5, tokens: Infinity, seats: 3 },
      { id: 'business', price: 2999, trial: 14, counters: 25, tokens: Infinity, seats: 15 },
      { id: 'enterprise', price: null, trial: 0, counters: Infinity, tokens: Infinity, seats: Infinity },
    ]);
    expect(planLimit('pro', 'smsPerMonth')).toBe(100);
    expect(planLimit('business', 'locations')).toBe(5);
  });

  test('extras build up from plan to plan', () => {
    expect(Object.keys(getPlan('free').features)).toEqual([]);
    expect(Object.keys(getPlan('pro').features).sort()).toEqual(['browserAlerts', 'removeBranding', 'smsAlerts', 'tvDisplay']);
    for (const extra of ['priorityQueues', 'advancedAnalytics', 'csvExport', 'apiAccess']) expect(hasFeature('business', extra)).toBe(true);
    for (const extra of ['customDomain', 'sso']) {
      expect(hasFeature('business', extra)).toBe(false);
      expect(hasFeature('enterprise', extra)).toBe(true);
    }
  });

  test('yearly billing is 20% cheaper, and Enterprise is custom', () => {
    expect(YEARLY_DISCOUNT).toBe(0.2);
    expect([planPrice('pro', 'monthly'), planPrice('pro', 'yearly')]).toEqual([999, 799]);
    expect([planPrice('business', 'monthly'), planPrice('business', 'yearly')]).toEqual([2999, 2399]);
    expect(planPrice('free', 'yearly')).toBe(0);
    expect(planPrice('enterprise', 'yearly')).toBeNull();
  });

  test('hasFeature accepts a business or a plan id; unknown plans count as Free', () => {
    expect(hasFeature({ plan: 'pro' }, 'tvDisplay')).toBe(true);
    expect(hasFeature({ plan: 'free' }, 'tvDisplay')).toBe(false);
    expect(hasFeature('pro', 'tvDisplay')).toBe(true);
    expect(hasFeature({ plan: 'made-up' }, 'tvDisplay')).toBe(false);
    expect(hasFeature(null, 'tvDisplay')).toBe(false);
  });

  test('the cheapest plan with each extra is used in upgrade prompts', () => {
    expect(planForFeature('tvDisplay').id).toBe('pro');
    expect(planForFeature('csvExport').id).toBe('business');
    expect(planForFeature('sso').id).toBe('enterprise');
  });
});

describe('requireFeature', () => {
  // A tiny app standing in for a route such as GET /api/admin/customers/export.csv (Phase 14).
  const appFor = (plan) => {
    const app = express();
    app.use((req, res, next) => {
      req.business = { plan };
      next();
    });
    app.get('/export.csv', requireFeature('csvExport'), (req, res) => res.json({ ok: true }));
    app.use(errorMiddleware);
    return app;
  };

  test('returns 402 PLAN_REQUIRED, naming the plan that unlocks it', async () => {
    for (const plan of ['free', 'pro']) {
      const res = await request(appFor(plan)).get('/export.csv');
      expect(res.status).toBe(402);
      expect(res.body.error).toEqual({
        code: 'PLAN_REQUIRED',
        message: 'CSV export is on the Business plan. Upgrade to use it.',
        details: { feature: 'csvExport', requiredPlan: 'business' },
      });
    }
  });

  test('lets the request through on plans that include it', async () => {
    for (const plan of ['business', 'enterprise']) expect((await request(appFor(plan)).get('/export.csv')).status).toBe(200);
  });
});

/* ---------------------------------------------- Step 13.2: billing endpoints */

// Webhooks signed exactly the way Stripe signs them, with the test secret from tests/setup.js.
const signer = new Stripe('sk_test_signer_only');
let eventSeq = 0;
const sendEvent = (type, object, { id = `evt_test_${(eventSeq += 1)}`, signature } = {}) => {
  const payload = JSON.stringify({ id, object: 'event', type, data: { object } });
  const header = signature ?? signer.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET });
  return { id, response: request(app).post('/api/billing/webhook').set('Content-Type', 'application/json').set('Stripe-Signature', header).send(payload) };
};
const now = () => Math.floor(Date.now() / 1000);

const checkoutCompleted = ({ businessId, plan = 'pro', cycle = 'monthly', sub = 'sub_1', trial = true }) => ({
  id: 'cs_test_done', object: 'checkout.session', mode: 'subscription', subscription: sub, customer: 'cus_1',
  metadata: { businessId: String(businessId), plan, cycle, trial: String(trial) },
});
const invoicePaid = ({ businessId, plan = 'pro', cycle = 'monthly', sub = 'sub_1', id = 'in_1', number = 'QL-0001', amount = 99900 }) => ({
  id, object: 'invoice', number, amount_paid: amount, amount_due: amount, currency: 'inr', created: now(), customer: 'cus_1',
  invoice_pdf: `https://pay.stripe.com/invoice/${id}/pdf`,
  parent: { subscription_details: { subscription: sub, metadata: { businessId: String(businessId), plan, cycle } } },
  lines: { data: [{ period: { end: now() + 30 * 86400 } }] },
});
const subscriptionDeleted = (sub = 'sub_1') => ({ id: sub, object: 'subscription', status: 'canceled', metadata: {} });

let ownerSeq = 0;
async function owner(businessType = 'canteen') {
  ownerSeq += 1;
  const res = await request(app).post('/api/auth/signup').send({
    name: 'Meera', email: `billing${ownerSeq}@test.example`, password: 'Sunrise#2024', businessName: `Shop ${ownerSeq}`, businessType, terms: true,
  });
  const auth = `Bearer ${res.body.accessToken}`;
  const businessId = res.body.business.id;
  await Business.updateOne({ _id: businessId }, { isLive: true, 'setup.slugConfirmed': true });
  const api = (method, path, body) => request(app)[method](`/api/billing${path}`).set('Authorization', auth).send(body);
  return { auth, businessId, slug: res.body.business.slug, api, reload: () => Business.findById(businessId) };
}

describe('upgrading through checkout and webhooks (Done when #1)', () => {
  test('a test-mode payment upgrades the business through the webhook and unlocks the TV display', async () => {
    const o = await owner();
    expect((await request(app).get(`/api/display/${o.slug}`)).status).toBe(402);

    // 1. Checkout: a Stripe page to pay on. Nothing changes yet.
    const checkout = await o.api('post', '/checkout', { plan: 'pro', cycle: 'monthly' });
    expect(checkout.status).toBe(201);
    expect(checkout.body).toMatchObject({ url: 'https://checkout.stripe.com/c/pay/cs_test_example', trialDays: 14 });
    const [, args] = stripeCalls.find(([kind]) => kind === 'checkout');
    expect(args).toMatchObject({
      mode: 'subscription',
      customer_email: `billing${ownerSeq}@test.example`,
      line_items: [{ quantity: 1, price_data: { currency: 'inr', unit_amount: 99900, recurring: { interval: 'month' } } }],
      subscription_data: { trial_period_days: 14, metadata: { businessId: o.businessId, plan: 'pro', cycle: 'monthly' } },
    });
    expect((await o.reload()).plan).toBe('free');

    // 2. Stripe confirms: the plan switches on, the TV display unlocks.
    const done = sendEvent('checkout.session.completed', checkoutCompleted({ businessId: o.businessId }));
    expect((await done.response).body).toEqual({ received: true, duplicate: false, handled: true });
    expect((await o.reload()).plan).toBe('pro');
    expect(await Subscription.findOne({ businessId: o.businessId })).toMatchObject({ plan: 'pro', status: 'trialing', providerSubscriptionId: 'sub_1', providerCustomerId: 'cus_1' });
    expect((await request(app).get(`/api/display/${o.slug}`)).status).toBe(200);

    // 3. The ₹0 trial invoice, then the first real payment after the trial.
    await sendEvent('invoice.paid', invoicePaid({ businessId: o.businessId, id: 'in_trial', number: 'QL-0001', amount: 0 })).response;
    await sendEvent('invoice.paid', invoicePaid({ businessId: o.businessId, id: 'in_paid', number: 'QL-0002', amount: 99900 })).response;
    const overview = await o.api('get', '/');
    expect(overview.body.subscription).toMatchObject({ status: 'active', plan: 'pro' });
    expect(overview.body.invoices.map((i) => [i.number, i.amount, i.status])).toEqual(expect.arrayContaining([['QL-0001', 0, 'trial'], ['QL-0002', 999, 'paid']]));
    expect(await ActivityLog.exists({ businessId: o.businessId, text: 'Plan changed to Pro (free trial)' })).toBeTruthy();
  });

  test('the plan switches on even if the invoice arrives before "checkout completed"', async () => {
    const o = await owner();
    await sendEvent('invoice.paid', invoicePaid({ businessId: o.businessId, plan: 'business', cycle: 'yearly', amount: 2878800 })).response;
    expect((await o.reload())).toMatchObject({ plan: 'business', billingCycle: 'yearly' });
    // The late "checkout completed" changes nothing further.
    await sendEvent('checkout.session.completed', checkoutCompleted({ businessId: o.businessId, plan: 'business', cycle: 'yearly', trial: false })).response;
    expect(await Subscription.countDocuments()).toBe(1);
    expect(await Invoice.countDocuments()).toBe(1);
  });

  test('switching Pro to Business cancels the old subscription, and its later "deleted" event changes nothing', async () => {
    const o = await owner();
    await sendEvent('checkout.session.completed', checkoutCompleted({ businessId: o.businessId, sub: 'sub_pro' })).response;
    const checkout = await o.api('post', '/checkout', { plan: 'business', cycle: 'monthly' });
    expect(checkout.body.trialDays).toBe(0); // one trial per business
    await sendEvent('checkout.session.completed', checkoutCompleted({ businessId: o.businessId, plan: 'business', sub: 'sub_business', trial: false })).response;

    expect((await o.reload()).plan).toBe('business');
    expect(stripeCalls).toContainEqual(['cancel', 'sub_pro']);
    await sendEvent('customer.subscription.deleted', subscriptionDeleted('sub_pro')).response;
    expect((await o.reload()).plan).toBe('business');
  });

  test('a failed renewal marks the subscription past due but keeps the plan', async () => {
    const o = await owner();
    await sendEvent('checkout.session.completed', checkoutCompleted({ businessId: o.businessId, trial: false })).response;
    await sendEvent('invoice.payment_failed', invoicePaid({ businessId: o.businessId, id: 'in_failed', number: 'QL-0009' })).response;
    expect((await o.reload()).plan).toBe('pro');
    expect((await Subscription.findOne({ businessId: o.businessId })).status).toBe('past_due');
    expect((await Invoice.findOne({ providerInvoiceId: 'in_failed' })).status).toBe('failed');
  });
});

describe('webhook safety (Done when #2)', () => {
  test('replaying the same webhook does not create a second invoice', async () => {
    const o = await owner();
    await sendEvent('checkout.session.completed', checkoutCompleted({ businessId: o.businessId })).response;
    const paid = invoicePaid({ businessId: o.businessId });
    const first = await sendEvent('invoice.paid', paid, { id: 'evt_same' }).response;
    const again = await sendEvent('invoice.paid', paid, { id: 'evt_same' }).response;
    expect(first.body.duplicate).toBe(false);
    expect([again.status, again.body.duplicate]).toEqual([200, true]);
    expect(await Invoice.countDocuments()).toBe(1);

    // The same invoice delivered under a different event id is still only one invoice.
    await sendEvent('invoice.paid', paid).response;
    expect(await Invoice.countDocuments()).toBe(1);
  });

  test('a missing, wrong, or tampered signature is refused and changes nothing', async () => {
    const o = await owner();
    const object = checkoutCompleted({ businessId: o.businessId });
    const missing = await request(app).post('/api/billing/webhook').set('Content-Type', 'application/json').send(JSON.stringify({ id: 'evt_x', type: 'checkout.session.completed', data: { object } }));
    expect([missing.status, missing.body.error.code]).toEqual([400, 'INVALID_SIGNATURE']);

    const wrongSecret = signer.webhooks.generateTestHeaderString({ payload: '{}', secret: 'whsec_somebody_else' });
    expect((await sendEvent('checkout.session.completed', object, { signature: wrongSecret }).response).status).toBe(400);

    // Signed for one body, sent with another (someone editing the plan in transit).
    const payload = JSON.stringify({ id: 'evt_y', type: 'checkout.session.completed', data: { object } });
    const header = signer.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET });
    const tampered = await request(app).post('/api/billing/webhook').set('Content-Type', 'application/json').set('Stripe-Signature', header).send(payload.replace('"pro"', '"business"'));
    expect(tampered.status).toBe(400);

    expect((await o.reload()).plan).toBe('free');
    expect(await WebhookEvent.countDocuments()).toBe(0);
  });

  test('the browser cannot switch a paid plan on', async () => {
    const o = await owner();
    const res = await o.api('post', '/plan', { plan: 'pro' });
    expect([res.status, res.body.error.details[0].message]).toEqual([400, 'Paid plans start through checkout']);
    expect((await o.api('post', '/checkout', { plan: 'enterprise' })).status).toBe(400);
    expect((await o.reload()).plan).toBe('free');
  });
});

/* ------------------------------------------- Step 13.3: downgrades and limits */

describe('downgrading (Done when #3)', () => {
  test('choosing Free ends the subscription at the end of the paid period, then removes no data', async () => {
    const o = await owner();
    await sendEvent('checkout.session.completed', checkoutCompleted({ businessId: o.businessId, trial: false })).response;

    // While on Pro: 3 counters, a staff member, and customers in line.
    const [counter] = await Resource.find({ businessId: o.businessId });
    await Resource.create([2, 3].map((i) => ({ businessId: o.businessId, name: `Counter ${i}`, serviceIds: counter.serviceIds })));
    await User.create({ name: 'Staff', email: `staff${ownerSeq}@test.example`, passwordHash: 'x', role: 'staff', businessId: o.businessId });
    await request(app).post(`/api/public/${o.slug}/tokens`).send({ customer: { name: 'Kiran Rao', phone: '9876543210' } });
    const before = await Promise.all([Resource, User, Token, Service].map((m) => m.countDocuments({ businessId: o.businessId })));

    // Choosing Free: Stripe is told to stop at the end of the period; Pro stays until then.
    const res = await o.api('post', '/plan', { plan: 'free' });
    expect(res.body).toMatchObject({ effective: 'at_period_end', subscription: { cancelAtPeriodEnd: true }, plan: { id: 'pro' } });
    expect(stripeCalls).toContainEqual(['update', 'sub_1', { cancel_at_period_end: true }]);

    // The period ends.
    await sendEvent('customer.subscription.deleted', subscriptionDeleted('sub_1')).response;
    expect((await o.reload()).plan).toBe('free');
    expect(await Promise.all([Resource, User, Token, Service].map((m) => m.countDocuments({ businessId: o.businessId })))).toEqual(before);

    // Extras lock; new additions are blocked; existing things stay editable.
    expect((await request(app).get(`/api/display/${o.slug}`)).status).toBe(402);
    const usage = (await o.api('get', '/')).body.usage;
    expect(usage.counters).toEqual({ used: 3, limit: 1 });
    expect(usage.staffSeats).toEqual({ used: 1, limit: 1 });
    const admin = (method, path, body) => request(app)[method](`/api/admin${path}`).set('Authorization', o.auth).send(body);
    expect((await admin('post', '/resources', { name: 'Counter 4', serviceIds: [String(counter.serviceIds[0])] })).body.error.code).toBe('PLAN_LIMIT');
    expect((await admin('patch', `/resources/${counter.id}`, { name: 'Front desk' })).status).toBe(200);
  });

  test('"Skip for now" (no subscription) moves to Free at once', async () => {
    const o = await owner();
    await Business.updateOne({ _id: o.businessId }, { plan: 'pro', intendedPlan: 'pro' });
    const res = await o.api('post', '/plan', { plan: 'free' });
    expect(res.body.effective).toBe('now');
    expect(await o.reload()).toMatchObject({ plan: 'free', intendedPlan: null });
    expect(stripeCalls).toEqual([]);
  });
});

describe('billing overview and setup', () => {
  test('shows the plan, usage meters, and invoices; owners only', async () => {
    const o = await owner();
    await request(app).post(`/api/public/${o.slug}/tokens`).send({ customer: { name: 'Kiran Rao', phone: '9876543210' } });
    const res = await o.api('get', '/');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      plan: { id: 'free', cycle: 'monthly', pricePerMonth: 0, limits: { tokensPerDay: 50 } },
      subscription: null,
      paymentMethod: null,
      usage: { tokensToday: { used: 1, limit: 50 }, counters: { used: 1, limit: 1 }, staffSeats: { used: 0, limit: 1 }, smsThisMonth: { used: 0, limit: 0 } },
      invoices: [],
    });

    const staff = await User.create({ name: 'S', email: `s${ownerSeq}@test.example`, passwordHash: 'x', role: 'staff', businessId: o.businessId });
    expect((await request(app).get('/api/billing').set('Authorization', `Bearer ${issueTokens(staff).accessToken}`)).status).toBe(403);
  });

  test('checkout says clearly when payments are not set up, and refuses the plan you already have', async () => {
    const o = await owner();
    setStripeClient(null);
    const res = await o.api('post', '/checkout', { plan: 'pro' });
    expect([res.status, res.body.error.code]).toEqual([503, 'PAYMENTS_NOT_CONFIGURED']);

    setStripeClient(fakeStripe);
    await sendEvent('checkout.session.completed', checkoutCompleted({ businessId: o.businessId, trial: false })).response;
    expect((await o.api('post', '/checkout', { plan: 'pro', cycle: 'monthly' })).body.error.code).toBe('ALREADY_ON_PLAN');
    const yearly = await o.api('post', '/checkout', { plan: 'pro', cycle: 'yearly' });
    expect(yearly.status).toBe(201);
    expect(stripeCalls.at(-1)[1].line_items[0].price_data).toMatchObject({ unit_amount: 958800, recurring: { interval: 'year' } }); // ₹799 × 12
  });
});
