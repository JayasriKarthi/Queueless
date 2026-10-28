import { Router } from 'express';
import { publicBusiness } from '../middleware/tenant.middleware.js';
import { requireOpenQueue } from '../middleware/goLive.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { joinIpLimit, joinPhoneLimit } from '../middleware/rateLimit.middleware.js';
import { joinSchema, tokenStatusParams, leaveSchema, rateSchema } from '../validators/token.validator.js';
import * as tokens from '../controllers/token.controller.js';

// Customer routes. No login: the business is found from the slug in the URL.
// Joining is limited per device (IP) and per phone number at this business.
const router = Router();

router.get('/:slug', publicBusiness, tokens.publicPage);
router.post('/:slug/tokens', joinIpLimit, publicBusiness, joinPhoneLimit, requireOpenQueue, validate({ body: joinSchema }), tokens.join);
router.get('/:slug/tokens/:id', publicBusiness, validate({ params: tokenStatusParams }), tokens.status);
router.post('/:slug/tokens/:id/leave', publicBusiness, validate({ params: tokenStatusParams, body: leaveSchema }), tokens.leave);
router.post('/:slug/tokens/:id/rate', publicBusiness, validate({ params: tokenStatusParams, body: rateSchema }), tokens.rate);

export default router;
