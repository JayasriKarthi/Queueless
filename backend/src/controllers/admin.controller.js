import * as catalog from '../services/catalog.service.js';
import { listNotifications, markAllRead } from '../services/notification.service.js';
import { analyticsReport } from '../services/analytics.service.js';
import { listCustomers, streamCustomersCsv } from '../services/customers.service.js';
import { dateKey } from '../utils/tokenNumber.js';
import { recentActivity } from '../services/activity.service.js';

/* ------------------------------------------------ analytics and history */

// GET /api/admin/analytics?range=14
export async function analytics(req, res) {
  res.json({ ok: true, ...(await analyticsReport(req.business, req.validatedQuery.range)) });
}

// GET /api/admin/customers?q=&status=&serviceId=&resourceId=&days=&page=&pageSize=
export async function customers(req, res) {
  res.json({ ok: true, ...(await listCustomers(req.business, req.validatedQuery)) });
}

// GET /api/admin/customers/export.csv (Business plan and up)
export async function customersCsv(req, res) {
  const file = `${req.business.slug}-customers-${dateKey(new Date(), req.business.timeZone)}.csv`;
  res.type('text/csv; charset=utf-8').attachment(file);
  await streamCustomersCsv(req.business, req.validatedQuery, res);
}

// GET /api/admin/activity?limit=20 (Home page "Recent activity")
export async function activity(req, res) {
  res.json({ ok: true, activity: await recentActivity(req.business, req.validatedQuery.limit) });
}

/* -------------------------------------------------------- the bell */

// GET /api/admin/notifications
export async function notifications(req, res) {
  res.json({ ok: true, ...(await listNotifications(req.business)) });
}

// POST /api/admin/notifications/read
export async function readNotifications(req, res) {
  res.json({ ok: true, marked: await markAllRead(req.business) });
}

/* ------------------------------------------------------------ services */

// GET /api/admin/services?status=active|inactive|all&q=
export async function listServices(req, res) {
  res.json({ ok: true, services: await catalog.listServices(req.business, req.validatedQuery) });
}

// POST /api/admin/services
export async function createService(req, res) {
  const service = await catalog.createService(req.business, req.body, req.user._id);
  res.status(201).json({ ok: true, service });
}

// PATCH /api/admin/services/:id
export async function updateService(req, res) {
  const service = await catalog.updateService(req.business, req.params.id, req.body, req.user._id);
  res.json({ ok: true, service });
}

// DELETE /api/admin/services/:id
export async function deleteService(req, res) {
  await catalog.deleteServices(req.business, [req.params.id], req.user._id);
  res.json({ ok: true });
}

// POST /api/admin/services/bulk  { ids, action }
export async function bulkServices(req, res) {
  const { ids, action } = req.body;
  if (action === 'delete') await catalog.deleteServices(req.business, ids, req.user._id);
  else await catalog.setServicesActive(req.business, ids, action === 'activate', req.user._id);
  res.json({ ok: true, action, count: ids.length });
}

/* ----------------------------------------------------------- resources */

// GET /api/admin/resources?status=active|inactive|all&q=
export async function listResources(req, res) {
  res.json({ ok: true, resources: await catalog.listResources(req.business, req.validatedQuery) });
}

// POST /api/admin/resources
export async function createResource(req, res) {
  const resource = await catalog.createResource(req.business, req.body, req.user._id);
  res.status(201).json({ ok: true, resource });
}

// PATCH /api/admin/resources/:id
export async function updateResource(req, res) {
  const resource = await catalog.updateResource(req.business, req.params.id, req.body, req.user._id);
  res.json({ ok: true, resource });
}

// DELETE /api/admin/resources/:id
export async function deleteResource(req, res) {
  await catalog.deleteResources(req.business, [req.params.id], req.user._id);
  res.json({ ok: true });
}

// POST /api/admin/resources/bulk  { ids, action }
export async function bulkResources(req, res) {
  const { ids, action } = req.body;
  if (action === 'delete') await catalog.deleteResources(req.business, ids, req.user._id);
  else await catalog.setResourcesActive(req.business, ids, action === 'activate', req.user._id);
  res.json({ ok: true, action, count: ids.length });
}
