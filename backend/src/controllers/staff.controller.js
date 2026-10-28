import * as staffService from '../services/staff.service.js';
import { staffToken, publicToken } from '../services/token.service.js';
import { homeFor } from '../services/auth.service.js';
import { startSession } from './auth.controller.js';

// GET /api/staff/team
export async function team(req, res) {
  res.json({ ok: true, team: await staffService.team(req.business) });
}

// POST /api/staff/switch-user: the picked person is now logged in on this computer.
export async function switchUser(req, res) {
  const user = await staffService.switchUser(req.business, req.body);
  const accessToken = startSession(res, user);
  res.json({ ok: true, user, accessToken, home: homeFor(user.role) });
}

// GET /api/staff/console?resourceId=
export async function getConsole(req, res) {
  res.json({ ok: true, ...(await staffService.consoleView(req.user, req.business, req.validatedQuery)) });
}

// POST /api/staff/resources/:id/call-next
export async function callNext(req, res) {
  const { called, finished } = await staffService.callNext(req.user, req.business, req.params.id);
  res.json({
    ok: true,
    called: staffToken(called) ?? null,
    finished: staffToken(finished) ?? null,
    ...(!called && { message: 'Nobody is waiting for this line right now' }),
  });
}

// PATCH /api/staff/resources/:id/pause
export async function pause(req, res) {
  const resource = await staffService.setPaused(req.user, req.business, req.params.id, req.body.isPaused);
  res.json({ ok: true, resource });
}

// POST /api/staff/tokens/:id/call
export async function callToken(req, res) {
  const token = await staffService.callToken(req.user, req.business, req.params.id, req.body);
  res.json({ ok: true, token: staffToken(token) });
}

// POST /api/staff/tokens/:id/arrived | done | no-show | recall | skip | remove
export const act = (action) => async (req, res) => {
  const token = await staffService.actOnToken(req.user, req.business, req.params.id, action);
  res.json({ ok: true, token: staffToken(token) });
};

// POST /api/staff/walk-in
export async function walkIn(req, res) {
  const { token, existing, ahead } = await staffService.walkIn(req.user, req.business, req.body);
  res.status(existing ? 200 : 201).json({ ok: true, existing, token: { ...publicToken(token), customer: token.customer }, ahead });
}
