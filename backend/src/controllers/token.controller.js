import * as tokenService from '../services/token.service.js';
import { publicJoinPage } from '../services/business.service.js';

// GET /api/public/:slug: everything the join page needs.
export async function publicPage(req, res) {
  res.json({ ok: true, ...(await publicJoinPage(req.business)) });
}

// POST /api/public/:slug/tokens
// 201 with a new token and its guestSecret, or 200 with the phone's existing active token.
export async function join(req, res) {
  const { token, existing, ahead, guestSecret } = await tokenService.joinQueue(req.business, req.body);
  res.status(existing ? 200 : 201).json({
    ok: true,
    existing,
    token: tokenService.publicToken(token),
    ahead,
    ...(guestSecret && { guestSecret }),
  });
}

// POST /api/public/:slug/tokens/:id/leave  { guestSecret }
export async function leave(req, res) {
  const token = await tokenService.leaveQueue(req.business, req.params.id, req.body.guestSecret);
  res.json({ ok: true, token: tokenService.publicToken(token) });
}

// POST /api/public/:slug/tokens/:id/rate  { guestSecret, rating }
export async function rate(req, res) {
  const token = await tokenService.rateVisit(req.business, req.params.id, req.body.guestSecret, req.body.rating);
  res.json({ ok: true, token: tokenService.publicToken(token) });
}

// GET /api/public/:slug/tokens/:id
export async function status(req, res) {
  res.json({ ok: true, ...(await tokenService.tokenStatus(req.business, req.params.id)) });
}
