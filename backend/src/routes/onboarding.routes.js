import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireOwner } from '../middleware/role.middleware.js';
import { tenantScope } from '../middleware/tenant.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { welcomeSchema } from '../validators/business.validator.js';
import * as onboarding from '../controllers/onboarding.controller.js';

const router = Router();
router.use(requireAuth, requireOwner, tenantScope);

router.post('/welcome', validate({ body: welcomeSchema }), onboarding.welcome);
// "Skip for now" and the Free plan call POST /api/billing/plan (Phase 13).

export default router;
