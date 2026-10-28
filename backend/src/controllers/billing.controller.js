import * as billingService from '../services/billing.service.js';

// GET /api/billing
export async function overview(req, res) {
  res.json({ ok: true, ...(await billingService.billingOverview(req.business)) });
}

// POST /api/billing/plan { plan: 'free' }
export async function choosePlan(req, res) {
  const { effective } = await billingService.chooseFree(req.business, req.user._id);
  res.json({ ok: true, effective, ...(await billingService.billingOverview(req.business)) });
}

// POST /api/billing/checkout { plan, cycle }: the frontend sends the owner to `url`.
export async function checkout(req, res) {
  res.status(201).json({ ok: true, ...(await billingService.createCheckout(req.business, req.user, req.body)) });
}

// POST /api/billing/webhook (called by Stripe, not the browser). req.body is the raw Buffer.
// A bad signature answers 400; a processing error answers 500, so Stripe retries later.
export async function webhook(req, res) {
  const event = billingService.verifyWebhook(req.body, req.get('stripe-signature'));
  const result = await billingService.handleWebhook(event);
  res.json({ received: true, ...result });
}
