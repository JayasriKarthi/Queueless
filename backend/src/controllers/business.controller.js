import * as businessService from '../services/business.service.js';
import * as slugService from '../services/slug.service.js';
import * as brandingService from '../services/branding.service.js';

const respond = async (res, business) => res.json({ ok: true, ...(await businessService.businessView(business)) });

// GET /api/business
export const getBusiness = (req, res) => respond(res, req.business);

// PATCH /api/business/settings
export async function updateSettings(req, res) {
  const business = await businessService.updateSettings(req.business, req.body, req.user._id);
  await respond(res, business);
}

// GET /api/business/go-live
export async function goLiveChecklist(req, res) {
  res.json({ ok: true, ...(await businessService.goLiveChecklist(req.business)) });
}

// POST /api/business/go-live
export async function goLive(req, res) {
  const business = await businessService.goLive(req.business, req.user._id);
  await respond(res, business);
}

// PATCH /api/business/open  { isOpen }
export async function setOpen(req, res) {
  const business = await businessService.setOpen(req.business, req.body.isOpen, req.user._id);
  await respond(res, business);
}

// GET /api/business/qr.png?size=512: downloads as <slug>-qr.png
export async function qrPng(req, res) {
  const png = await businessService.joinQrPng(req.business, req.validatedQuery.size);
  res.type('png').attachment(`${req.business.slug}-qr.png`).send(png);
}

// GET /api/business/slug/check?slug=
export async function checkSlug(req, res) {
  const { slug } = req.validatedQuery;
  res.json({ ok: true, slug, ...(await slugService.checkAvailability(slug, req.business)) });
}

// PATCH /api/business/slug
export async function changeSlug(req, res) {
  const business = await slugService.changeSlug(req.business, req.body.slug, { confirmBreakingQr: req.body.confirmBreakingQr, actorId: req.user._id });
  await respond(res, business);
}

// PATCH /api/business/branding
export async function updateBranding(req, res) {
  const business = await brandingService.updateBranding(req.business, req.body, req.user._id);
  await respond(res, business);
}

// POST /api/business/logo (multipart form, field "logo")
export async function uploadLogo(req, res) {
  const business = await brandingService.setLogo(req.business, req.file, req.user._id);
  await respond(res, business);
}

// DELETE /api/business/logo
export async function deleteLogo(req, res) {
  const business = await brandingService.deleteLogo(req.business, req.user._id);
  await respond(res, business);
}

// DELETE /api/business (Settings → Danger zone). 202: the rest is deleted in the background.
export async function deleteBusiness(req, res) {
  await businessService.deleteBusiness(req.business, req.body);
  res.status(202).json({ ok: true, message: 'Your business has been deleted.' });
}
