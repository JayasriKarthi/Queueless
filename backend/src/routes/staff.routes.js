import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import { tenantScope } from '../middleware/tenant.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { idParams } from '../validators/business.validator.js';
import { joinSchema, callTokenSchema, pauseSchema, consoleQuery } from '../validators/token.validator.js';
import { switchUserSchema } from '../validators/invite.validator.js';
import { requireStaff } from '../middleware/role.middleware.js';
import * as staff from '../controllers/staff.controller.js';

const router = Router();
// The staff console. Owners use the same actions from their Queues page.
// Staff are limited to their own resource inside the services (tenant.service rules).
router.use(requireAuth, requireRole('owner', 'manager', 'staff'), tenantScope);

const byId = validate({ params: idParams });

router.get('/console', validate({ query: consoleQuery }), staff.getConsole);
router.get('/team', staff.team);
// Switching starts from a staff or manager session on the shared computer (owners use /admin).
router.post('/switch-user', requireStaff, validate({ body: switchUserSchema }), staff.switchUser);
router.post('/walk-in', validate({ body: joinSchema }), staff.walkIn);

router.post('/resources/:id/call-next', byId, staff.callNext);
router.patch('/resources/:id/pause', validate({ params: idParams, body: pauseSchema }), staff.pause);

router.post('/tokens/:id/call', validate({ params: idParams, body: callTokenSchema }), staff.callToken);
router.post('/tokens/:id/arrived', byId, staff.act('arrived'));
router.post('/tokens/:id/done', byId, staff.act('done'));
router.post('/tokens/:id/no-show', byId, staff.act('noShow'));
router.post('/tokens/:id/recall', byId, staff.act('recall'));
router.post('/tokens/:id/skip', byId, staff.act('skip'));
router.post('/tokens/:id/remove', byId, staff.act('remove'));

export default router;
