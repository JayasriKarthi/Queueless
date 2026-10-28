import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireOwner } from '../middleware/role.middleware.js';
import { tenantScope } from '../middleware/tenant.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { linkCheckLimit } from '../middleware/rateLimit.middleware.js';
import { settingsSchema, slugCheckQuery, changeSlugSchema, brandingSchema, openSchema, qrQuery, deleteBusinessSchema } from '../validators/business.validator.js';
import { MAX_LOGO_BYTES } from '../services/branding.service.js';
import { ApiError } from '../utils/ApiError.js';
import * as business from '../controllers/business.controller.js';

// Logo uploads are kept in memory (at most 400 KB), checked, then saved by branding.service.
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const uploadLogo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_LOGO_BYTES, files: 1 },
  fileFilter: (req, file, done) =>
    LOGO_TYPES.includes(file.mimetype) ? done(null, true) : done(ApiError.badRequest('INVALID_IMAGE', 'Upload a PNG, JPG, or WebP image')),
}).single('logo');

const router = Router();
// Owner only, always for the logged-in owner's own business.
router.use(requireAuth, requireOwner, tenantScope);

router.get('/', business.getBusiness);
router.get('/go-live', business.goLiveChecklist);
router.post('/go-live', business.goLive);
router.patch('/open', validate({ body: openSchema }), business.setOpen);
router.get('/qr.png', validate({ query: qrQuery }), business.qrPng);
router.patch('/settings', validate({ body: settingsSchema }), business.updateSettings);
router.get('/slug/check', linkCheckLimit, validate({ query: slugCheckQuery }), business.checkSlug);
router.patch('/slug', validate({ body: changeSlugSchema }), business.changeSlug);
router.patch('/branding', validate({ body: brandingSchema }), business.updateBranding);
router.post('/logo', uploadLogo, business.uploadLogo);
router.delete('/logo', business.deleteLogo);
// Settings → Danger zone
router.delete('/', validate({ body: deleteBusinessSchema }), business.deleteBusiness);

export default router;
