import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireOwner } from '../middleware/role.middleware.js';
import { tenantScope } from '../middleware/tenant.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { enforceLimit, requireFeature } from '../middleware/planLimit.middleware.js';
import { countActivations } from '../services/catalog.service.js';
import {
  idParams, listQuery, bulkSchema,
  createServiceSchema, updateServiceSchema,
  createResourceSchema, updateResourceSchema,
  analyticsQuery, customersQuery, customersCsvQuery, activityQuery,
} from '../validators/business.validator.js';
import * as admin from '../controllers/admin.controller.js';

const router = Router();
// The admin panel is for owners, always on their own business.
router.use(requireAuth, requireOwner, tenantScope);

// Analytics (advanced parts by plan) and the customer history, with CSV export on Business.
router.get('/analytics', validate({ query: analyticsQuery }), admin.analytics);
router.get('/customers', validate({ query: customersQuery }), admin.customers);
router.get('/customers/export.csv', requireFeature('csvExport'), validate({ query: customersCsvQuery }), admin.customersCsv);

// The bell: notifications for the owner, and marking them read.
router.get('/activity', validate({ query: activityQuery }), admin.activity);
router.get('/notifications', admin.notifications);
router.post('/notifications/read', admin.readNotifications);

// Services: what customers queue for.
router.get('/services', validate({ query: listQuery }), admin.listServices);
router.post('/services', validate({ body: createServiceSchema }), admin.createService);
router.post('/services/bulk', validate({ body: bulkSchema }), admin.bulkServices);
router.patch('/services/:id', validate({ params: idParams, body: updateServiceSchema }), admin.updateService);
router.delete('/services/:id', validate({ params: idParams }), admin.deleteService);

// Resources: doctors, counters, or stylists. Switching one on counts against the plan's counter limit.
router.get('/resources', validate({ query: listQuery }), admin.listResources);
router.post(
  '/resources',
  validate({ body: createResourceSchema }),
  enforceLimit('counters', (req) => (req.body.isActive ? 1 : 0)),
  admin.createResource,
);
router.post(
  '/resources/bulk',
  validate({ body: bulkSchema }),
  enforceLimit('counters', (req) => (req.body.action === 'activate' ? countActivations(req.business, req.body.ids) : 0)),
  admin.bulkResources,
);
router.patch(
  '/resources/:id',
  validate({ params: idParams, body: updateResourceSchema }),
  enforceLimit('counters', (req) => (req.body.isActive === true ? countActivations(req.business, [req.params.id]) : 0)),
  admin.updateResource,
);
router.delete('/resources/:id', validate({ params: idParams }), admin.deleteResource);

export default router;
