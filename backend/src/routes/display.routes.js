import { Router } from 'express';
import { publicBusiness } from '../middleware/tenant.middleware.js';
import * as display from '../controllers/display.controller.js';

// Waiting-room TVs. No login: the business is found from the slug (old slugs redirect).
const router = Router();

router.get('/:slug', publicBusiness, display.getDisplay);

export default router;
