import * as catalog from '../services/catalog.service.js';

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
