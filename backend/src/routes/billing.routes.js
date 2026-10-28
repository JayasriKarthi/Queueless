import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireOwner } from '../middleware/role.middleware.js';
import { tenantScope } from '../middleware/tenant.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { changePlanSchema, checkoutSchema } from '../validators/billing.validator.js';
import * as billing from '../controllers/billing.controller.js';

const router = Router();

// Stripe calls this, so it has no login: the signature proves it came from Stripe.
// app.js gives this path the raw body (express.raw) before the JSON parser runs.
router.post('/webhook', billing.webhook);

// Everything else is for the business owner.
router.use(requireAuth, requireOwner, tenantScope);
router.get('/', billing.overview);
router.post('/plan', validate({ body: changePlanSchema }), billing.choosePlan);
router.post('/checkout', validate({ body: checkoutSchema }), billing.checkout);

export default router;
