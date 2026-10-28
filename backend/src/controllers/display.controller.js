import { displayView } from '../services/business.service.js';

// GET /api/display/:slug. The TV loads this once, then follows live events in display:<id>.
export async function getDisplay(req, res) {
  res.json({ ok: true, ...(await displayView(req.business)) });
}
