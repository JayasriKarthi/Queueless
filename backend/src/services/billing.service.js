import mongoose from 'mongoose';
import Stripe from 'stripe';
import { env } from '../config/env.js';
import { Business } from '../models/Business.js';
import { Subscription } from '../models/Subscription.js';
import { Invoice } from '../models/Invoice.js';
import { Queue } from '../models/Queue.js';
import { WebhookEvent } from '../models/WebhookEvent.js';
import { ApiError } from '../utils/ApiError.js';
import { getPlan, planPrice, planLimit, planForClient } from '../utils/constants.js';
import { dateKey } from '../utils/tokenNumber.js';
import { usageOf } from '../middleware/planLimit.middleware.js';
import { logActivity } from './activity.service.js';
import { emitBusinessUpdated } from '../sockets/queue.socket.js';

// Payments run through Stripe Checkout (hosted page) and Stripe webhooks. The browser never
// switches a plan on: only a verified webhook does.

const PAID_PLANS = ['pro', 'business'];
const LIVE_STATUSES = ['trialing', 'active', 'past_due'];

// The API client (creating checkouts, cancelling subscriptions). Missing until STRIPE_SECRET_KEY
// is set; tests swap in a stand-in with setStripeClient().
let stripe = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY) : null;
export const setStripeClient = (client) => {
  stripe = client;
};
// Checking webhook signatures needs only the webhook secret, never a network call.
const signatureChecker = new Stripe(env.STRIPE_SECRET_KEY || 'sk_test_signature_checks_only');

function requireStripe() {
  if (!stripe) throw new ApiError(503, 'PAYMENTS_NOT_CONFIGURED', 'Payments are not set up yet. Add STRIPE_SECRET_KEY to the server settings.');
  return stripe;
}

const planLabel = (plan, cycle) => `${getPlan(plan).name} (${cycle})`;
const limitOf = (business, key) => (planLimit(business.plan, key) === Infinity ? null : planLimit(business.plan, key));

/* ----------------------------------------------------------- overview */

// GET /api/billing
export async function billingOverview(business) {
  const businessId = business._id;
  const [subscription, invoices, today, counters, staffSeats] = await Promise.all([
    Subscription.findOne({ businessId }),
    Invoice.find({ businessId }).sort({ date: -1 }).limit(24),
    Queue.findOne({ businessId, queueKey: 'all', date: dateKey(new Date(), business.timeZone) }).select('counters'),
    usageOf(business, 'counters'),
    usageOf(business, 'staffSeats'),
  ]);
  const live = subscription && LIVE_STATUSES.includes(subscription.status);

  return {
    plan: { ...planForClient(business.plan), cycle: business.billingCycle, pricePerMonth: planPrice(business.plan, business.billingCycle) },
    subscription: subscription && {
      plan: subscription.plan,
      cycle: subscription.cycle,
      status: subscription.status,
      trialEndsAt: subscription.trialEndsAt ?? null,
      currentPeriodEnd: subscription.currentPeriodEnd ?? null,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    },
    // Meters for the Billing page. A null limit means unlimited.
    usage: {
      tokensToday: { used: today?.counters?.get('total') ?? 0, limit: limitOf(business, 'tokensPerDay') },
      counters: { used: counters, limit: limitOf(business, 'counters') },
      staffSeats: { used: staffSeats, limit: limitOf(business, 'staffSeats') },
      smsThisMonth: { used: business.smsUsed ?? 0, limit: limitOf(business, 'smsPerMonth') },
    },
    // Card details stay with Stripe; changing the card happens on Stripe's own pages.
    paymentMethod: live ? { provider: 'stripe' } : null,
    invoices: invoices.map((i) => ({
      id: i.id, number: i.number, date: i.date, plan: i.plan,
      amount: i.amount / 100, currency: i.currency, status: i.status, pdfUrl: i.pdfUrl ?? null,
    })),
  };
}

/* ------------------------------------------------- choosing Free */

// POST /api/billing/plan { plan: 'free' }: "Skip for now", or downgrading. Never deletes data.
// A paid subscription runs to the end of the period the owner has paid for, then ends;
// Stripe's "subscription deleted" webhook moves the business to Free at that moment.
export async function chooseFree(business, actorId) {
  const subscription = await Subscription.findOne({ businessId: business._id });
  if (subscription && LIVE_STATUSES.includes(subscription.status) && subscription.providerSubscriptionId) {
    if (!subscription.cancelAtPeriodEnd) {
      await requireStripe().subscriptions.update(subscription.providerSubscriptionId, { cancel_at_period_end: true });
      subscription.cancelAtPeriodEnd = true;
      await subscription.save();
      await logActivity({ businessId: business._id, actorId, kind: 'billing', text: `${getPlan(subscription.plan).name} plan will end on its renewal date` });
    }
    return { business, subscription, effective: 'at_period_end' };
  }

  // Nothing to cancel (onboarding "Skip for now", or a plan set without a subscription).
  const changed = business.plan !== 'free';
  business.plan = 'free';
  business.billingCycle = 'monthly';
  business.intendedPlan = null;
  await business.save();
  if (changed) {
    await logActivity({ businessId: business._id, actorId, kind: 'billing', text: 'Plan changed to Free' });
    emitBusinessUpdated(business);
  }
  return { business, subscription, effective: 'now' };
}

/* ------------------------------------------------------- checkout */

// POST /api/billing/checkout { plan, cycle }: a Stripe Checkout page for the owner to pay on.
// Nothing changes here; the webhook switches the plan on once Stripe confirms.
export async function createCheckout(business, owner, { plan, cycle }) {
  const subscription = await Subscription.findOne({ businessId: business._id });
  if (subscription?.plan === plan && subscription.cycle === cycle && ['trialing', 'active'].includes(subscription.status) && !subscription.cancelAtPeriodEnd) {
    throw ApiError.conflict('ALREADY_ON_PLAN', `You are already on ${planLabel(plan, cycle)}`);
  }
  const client = requireStripe();
  const definition = getPlan(plan);
  const perMonth = planPrice(plan, cycle);
  // One free trial per business: only before its first subscription.
  const trialDays = !subscription && definition.trialDays ? definition.trialDays : 0;
  const metadata = { businessId: String(business._id), plan, cycle, trial: String(trialDays > 0) };

  const session = await client.checkout.sessions.create({
    mode: 'subscription',
    ...(subscription?.providerCustomerId ? { customer: subscription.providerCustomerId } : { customer_email: owner.email }),
    client_reference_id: String(business._id),
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'inr',
        unit_amount: (cycle === 'yearly' ? perMonth * 12 : perMonth) * 100, // in paise
        recurring: { interval: cycle === 'yearly' ? 'year' : 'month' },
        product_data: { name: `QueueLess ${definition.name}` },
      },
    }],
    // On the subscription too, so every later invoice and change can be traced to the business.
    subscription_data: { metadata, ...(trialDays && { trial_period_days: trialDays }) },
    metadata,
    success_url: `${env.CLIENT_URL}/admin/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.CLIENT_URL}/admin/billing?checkout=cancelled`,
  });
  return { url: session.url, sessionId: session.id, trialDays };
}

/* -------------------------------------------------------- webhooks */

export function verifyWebhook(rawBody, signature) {
  if (!env.STRIPE_WEBHOOK_SECRET) throw new ApiError(503, 'PAYMENTS_NOT_CONFIGURED', 'Payments are not set up yet. Add STRIPE_WEBHOOK_SECRET to the server settings.');
  if (!Buffer.isBuffer(rawBody) || !signature) throw ApiError.badRequest('INVALID_SIGNATURE', 'Missing webhook signature');
  try {
    return signatureChecker.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    throw ApiError.badRequest('INVALID_SIGNATURE', 'Webhook signature did not match');
  }
}

// Stripe has two shapes for where an invoice keeps its subscription; support both.
const subscriptionIdOf = (invoice) => invoice.subscription ?? invoice.parent?.subscription_details?.subscription ?? null;
const metadataOf = (object) => object.parent?.subscription_details?.metadata ?? object.subscription_details?.metadata ?? object.metadata ?? {};
const toDate = (seconds) => (seconds ? new Date(seconds * 1000) : undefined);
const periodEndOf = (object) => toDate(object.current_period_end ?? object.items?.data?.[0]?.current_period_end ?? object.lines?.data?.[0]?.period?.end);

// The business and its subscription record for an event: by the Stripe subscription id we
// already know, or else by the businessId we put in the subscription's metadata at checkout
// (events can arrive in any order).
async function findTarget({ subscriptionId, metadata }, session) {
  if (subscriptionId) {
    const subscription = await Subscription.findOne({ providerSubscriptionId: subscriptionId }).session(session);
    if (subscription) return { business: await Business.findById(subscription.businessId).session(session), subscription };
  }
  if (metadata.businessId && mongoose.isValidObjectId(metadata.businessId)) {
    const business = await Business.findById(metadata.businessId).session(session);
    if (business) return { business, subscription: await Subscription.findOne({ businessId: business._id }).session(session) };
  }
  return {};
}

// Switches a paid plan on. If the business had a different live subscription (Pro -> Business),
// that one is cancelled after the transaction commits.
async function activate({ business, subscription }, { subscriptionId, customerId, plan, cycle, status, trialEnd, periodEnd }, session, after) {
  if (!PAID_PLANS.includes(plan) || !['monthly', 'yearly'].includes(cycle)) return null;
  const previous = subscription?.providerSubscriptionId;
  if (previous && previous !== subscriptionId && LIVE_STATUSES.includes(subscription.status)) {
    after.push(() => stripe?.subscriptions.cancel(previous).catch((err) => console.error(`Could not cancel replaced subscription ${previous}`, err)));
  }
  const wasPlan = business.plan;
  await Subscription.findOneAndUpdate(
    { businessId: business._id },
    {
      $set: {
        plan, cycle, status, provider: 'stripe', providerSubscriptionId: subscriptionId, cancelAtPeriodEnd: false,
        ...(customerId && { providerCustomerId: customerId }),
        ...(trialEnd && { trialEndsAt: trialEnd }),
        ...(periodEnd && { currentPeriodEnd: periodEnd }),
      },
    },
    { upsert: true, session },
  );
  business.plan = plan;
  business.billingCycle = cycle;
  business.intendedPlan = null;
  await business.save({ session });
  if (wasPlan !== plan) {
    await logActivity({ businessId: business._id, kind: 'billing', text: `Plan changed to ${getPlan(plan).name}${status === 'trialing' ? ' (free trial)' : ''}` }, session);
  }
  return business;
}

async function recordInvoice(business, invoice, status, session) {
  const metadata = metadataOf(invoice);
  await Invoice.findOneAndUpdate(
    { providerInvoiceId: invoice.id },
    {
      $set: {
        businessId: business._id,
        number: invoice.number ?? invoice.id,
        date: toDate(invoice.status_transitions?.paid_at ?? invoice.created) ?? new Date(),
        plan: planLabel(metadata.plan ?? business.plan, metadata.cycle ?? business.billingCycle),
        amount: status === 'failed' ? invoice.amount_due ?? 0 : invoice.amount_paid ?? 0,
        currency: String(invoice.currency ?? 'inr').toUpperCase(),
        status,
        pdfUrl: invoice.invoice_pdf ?? invoice.hosted_invoice_url,
      },
    },
    { upsert: true, session },
  );
}

const HANDLERS = {
  // The owner finished paying (or started a trial) on Stripe's page.
  async 'checkout.session.completed'(session, db, after) {
    if (session.mode !== 'subscription') return null;
    const metadata = session.metadata ?? {};
    const target = await findTarget({ subscriptionId: session.subscription, metadata }, db);
    if (!target.business) return null;
    return activate(target, {
      subscriptionId: session.subscription, customerId: session.customer, plan: metadata.plan, cycle: metadata.cycle,
      status: metadata.trial === 'true' ? 'trialing' : 'active',
    }, db, after);
  },

  // The subscription was created or changed in Stripe (trial ended, renewed, set to cancel...).
  async 'customer.subscription.updated'(sub, db, after) {
    const metadata = sub.metadata ?? {};
    const target = await findTarget({ subscriptionId: sub.id, metadata }, db);
    if (!target.business) return null;
    const isCurrent = target.subscription?.providerSubscriptionId === sub.id;
    if (['trialing', 'active'].includes(sub.status) && !isCurrent) {
      return activate(target, { subscriptionId: sub.id, customerId: sub.customer, plan: metadata.plan, cycle: metadata.cycle, status: sub.status, trialEnd: toDate(sub.trial_end), periodEnd: periodEndOf(sub) }, db, after);
    }
    if (!isCurrent) return null;
    const status = { trialing: 'trialing', active: 'active', past_due: 'past_due', unpaid: 'past_due' }[sub.status];
    await Subscription.updateOne({ _id: target.subscription._id }, {
      $set: {
        ...(status && { status }),
        cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
        ...(toDate(sub.trial_end) && { trialEndsAt: toDate(sub.trial_end) }),
        ...(periodEndOf(sub) && { currentPeriodEnd: periodEndOf(sub) }),
      },
    }, { session: db });
    return null;
  },

  // Money collected (or a ₹0 invoice that starts a free trial).
  async 'invoice.paid'(invoice, db, after) {
    const subscriptionId = subscriptionIdOf(invoice);
    const metadata = metadataOf(invoice);
    const target = await findTarget({ subscriptionId, metadata }, db);
    if (!target.business) return null;
    let changed = null;
    const paid = (invoice.amount_paid ?? 0) > 0;
    if (target.subscription?.providerSubscriptionId !== subscriptionId) {
      // This invoice arrived before "checkout completed": switch the plan on from it.
      changed = await activate(target, { subscriptionId, customerId: invoice.customer, plan: metadata.plan, cycle: metadata.cycle, status: paid ? 'active' : 'trialing', periodEnd: periodEndOf(invoice) }, db, after);
    } else {
      await Subscription.updateOne({ _id: target.subscription._id }, {
        $set: { ...(paid && { status: 'active' }), ...(periodEndOf(invoice) && { currentPeriodEnd: periodEndOf(invoice) }) },
      }, { session: db });
    }
    await recordInvoice(target.business, invoice, paid ? 'paid' : 'trial', db);
    return changed;
  },

  // A renewal failed. The plan stays on while Stripe retries; the owner sees "past due".
  async 'invoice.payment_failed'(invoice, db) {
    const target = await findTarget({ subscriptionId: subscriptionIdOf(invoice), metadata: metadataOf(invoice) }, db);
    if (!target.business || !target.subscription) return null;
    await Subscription.updateOne({ _id: target.subscription._id }, { $set: { status: 'past_due' } }, { session: db });
    await recordInvoice(target.business, invoice, 'failed', db);
    await logActivity({ businessId: target.business._id, kind: 'billing', text: 'A payment failed. Stripe will try again.' }, db);
    return null;
  },

  // The subscription ended (cancelled at period end, or after failed payments).
  async 'customer.subscription.deleted'(sub, db) {
    const target = await findTarget({ subscriptionId: sub.id, metadata: {} }, db);
    // An old subscription replaced by a newer one (Pro -> Business) must not drop the plan.
    if (!target.business || target.subscription?.providerSubscriptionId !== sub.id) return null;
    await Subscription.updateOne({ _id: target.subscription._id }, { $set: { status: 'cancelled', cancelAtPeriodEnd: false } }, { session: db });
    // Back to Free. Every counter, staff member, and token is kept (Step 13.3).
    target.business.plan = 'free';
    target.business.billingCycle = 'monthly';
    await target.business.save({ session: db });
    await logActivity({ businessId: target.business._id, kind: 'billing', text: 'Paid plan ended. Now on Free; nothing was deleted.' }, db);
    return target.business;
  },
};
HANDLERS['customer.subscription.created'] = HANDLERS['customer.subscription.updated'];

// Applies an event exactly once. The event id is recorded in the same transaction as the
// changes: a repeat hits the unique index and is skipped, and a failure leaves no record,
// so Stripe's automatic retry runs it again.
export async function handleWebhook(event) {
  const handler = HANDLERS[event.type];
  let business = null;
  let after = [];
  try {
    await mongoose.connection.transaction(async (session) => {
      business = null;
      after = [];
      await WebhookEvent.create([{ provider: 'stripe', eventId: event.id, type: event.type }], { session });
      if (handler) business = await handler(event.data.object, session, after);
    });
  } catch (err) {
    if (err.code === 11000 && err.keyPattern?.eventId) return { duplicate: true, handled: false };
    throw err;
  }
  // Only after the commit: tell open screens, and cancel any replaced subscription.
  if (business) emitBusinessUpdated(business);
  await Promise.all(after.map((task) => task()));
  return { duplicate: false, handled: Boolean(handler) };
}
