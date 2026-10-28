import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireOwner } from '../middleware/role.middleware.js';
import { tenantScope } from '../middleware/tenant.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { idParams } from '../validators/business.validator.js';
import { createInviteSchema, inviteTokenParams, acceptInviteSchema, updateStaffSchema } from '../validators/invite.validator.js';
import * as invites from '../controllers/invite.controller.js';

// Mounted at /api. Owner routes live under /admin; the invitee's routes need no login.
const router = Router();
const owner = [requireAuth, requireOwner, tenantScope];

router.get('/admin/staff', owner, invites.listStaff);
router.patch('/admin/staff/:id', owner, validate({ params: idParams, body: updateStaffSchema }), invites.updateStaff);
router.post('/admin/staff/:id/reset-pin', owner, validate({ params: idParams }), invites.resetPin);
router.post('/admin/staff/:id/deactivate', owner, validate({ params: idParams }), invites.deactivateStaff);
router.post('/admin/staff/:id/reactivate', owner, validate({ params: idParams }), invites.reactivateStaff);
router.post('/admin/invites', owner, validate({ body: createInviteSchema }), invites.createInvite);
router.post('/admin/invites/:id/resend', owner, validate({ params: idParams }), invites.resendInvite);
router.post('/admin/invites/:id/revoke', owner, validate({ params: idParams }), invites.revokeInvite);

router.get('/invites/:token', validate({ params: inviteTokenParams }), invites.describeInvite);
router.post('/invites/:token/accept', validate({ params: inviteTokenParams, body: acceptInviteSchema }), invites.acceptInvite);

export default router;
