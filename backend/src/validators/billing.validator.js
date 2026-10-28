import { z } from 'zod';

const cycle = z.enum(['monthly', 'yearly'], { error: 'Choose monthly or yearly' }).default('monthly');

// POST /api/billing/plan: only Free ("Skip for now" or downgrading). Paid plans start through
// checkout and are switched on only by the payment provider's webhook, never by the browser.
export const changePlanSchema = z.strictObject({
  plan: z.literal('free', { error: 'Paid plans start through checkout' }),
});

// POST /api/billing/checkout. Enterprise is arranged through sales, not checkout.
export const checkoutSchema = z.strictObject({
  plan: z.enum(['pro', 'business'], { error: 'Choose Pro or Business (Enterprise is through sales)' }),
  cycle,
});
