import * as inviteService from '../services/invite.service.js';
import { homeFor } from '../services/auth.service.js';
import { startSession } from './auth.controller.js';

const inviteView = (invite) => ({
  id: invite.id,
  email: invite.email,
  role: invite.role,
  resourceId: invite.resourceId ? String(invite.resourceId) : null,
  status: inviteService.inviteStatus(invite),
  expiresAt: invite.expiresAt,
});

/* ---------------------------------------------------------- owners */

// GET /api/admin/staff
export async function listStaff(req, res) {
  res.json({ ok: true, ...(await inviteService.listStaff(req.business)) });
}

// POST /api/admin/invites
export async function createInvite(req, res) {
  const { invite, devInviteLink } = await inviteService.createInvite(req.business, req.body, req.user._id);
  res.status(201).json({ ok: true, invite: inviteView(invite), ...(devInviteLink && { devInviteLink }) });
}

// POST /api/admin/invites/:id/resend
export async function resendInvite(req, res) {
  const { invite, devInviteLink } = await inviteService.resendInvite(req.business, req.params.id, req.user._id);
  res.json({ ok: true, invite: inviteView(invite), ...(devInviteLink && { devInviteLink }) });
}

// POST /api/admin/invites/:id/revoke
export async function revokeInvite(req, res) {
  const { invite } = await inviteService.revokeInvite(req.business, req.params.id, req.user._id);
  res.json({ ok: true, invite: inviteView(invite) });
}

// PATCH /api/admin/staff/:id
export async function updateStaff(req, res) {
  res.json({ ok: true, user: await inviteService.updateStaff(req.business, req.params.id, req.body, req.user._id) });
}

// POST /api/admin/staff/:id/reset-pin: the new PIN is in this response only.
export async function resetPin(req, res) {
  const { user, pin } = await inviteService.resetPin(req.business, req.params.id, req.user._id);
  res.json({ ok: true, user, pin });
}

// POST /api/admin/staff/:id/deactivate
export async function deactivateStaff(req, res) {
  res.json({ ok: true, user: await inviteService.deactivateStaff(req.business, req.params.id, req.user._id) });
}

// POST /api/admin/staff/:id/reactivate
export async function reactivateStaff(req, res) {
  res.json({ ok: true, user: await inviteService.reactivateStaff(req.business, req.params.id, req.user._id) });
}

/* --------------------------------------------- invitees (no login) */

// GET /api/invites/:token
export async function describeInvite(req, res) {
  res.json({ ok: true, ...(await inviteService.describeInvite(req.params.token)) });
}

// POST /api/invites/:token/accept: creates the account and logs the new staff member in.
export async function acceptInvite(req, res) {
  const { user, generatedPin } = await inviteService.acceptInvite(req.params.token, req.body);
  const accessToken = startSession(res, user);
  res.status(201).json({ ok: true, user, accessToken, home: homeFor(user.role), ...(generatedPin && { generatedPin }) });
}
