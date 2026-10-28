import * as enterpriseService from '../services/enterprise.service.js';

// POST /api/enterprise/leads. Nothing is shown back but a thank-you.
export async function createLead(req, res) {
  await enterpriseService.createLead(req.body);
  res.status(201).json({ ok: true, message: 'Thanks! Our team will contact you within one working day.' });
}
