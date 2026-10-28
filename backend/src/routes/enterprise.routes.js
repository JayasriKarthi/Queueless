import { Router } from 'express';
import { validate } from '../middleware/validate.middleware.js';
import { enterpriseLeadLimit } from '../middleware/rateLimit.middleware.js';
import { enterpriseLeadSchema } from '../validators/enterprise.validator.js';
import * as enterprise from '../controllers/enterprise.controller.js';

// Public, no login: the marketing site's "Contact sales" form.
const router = Router();

router.post('/leads', enterpriseLeadLimit, validate({ body: enterpriseLeadSchema }), enterprise.createLead);

export default router;
