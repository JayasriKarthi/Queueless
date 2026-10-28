import * as businessService from '../services/business.service.js';
import { Service } from '../models/Service.js';
import { Resource } from '../models/Resource.js';
import { scoped } from '../services/tenant.service.js';

// POST /api/onboarding/welcome
export async function welcome(req, res) {
  const { business, reseeded } = await businessService.completeWelcome(req.business, req.body, req.user._id);
  const [services, resources] = await Promise.all([
    scoped(Service, business._id).find().sort({ sortOrder: 1 }),
    scoped(Resource, business._id).find(),
  ]);
  res.json({ ok: true, business, services, resources, reseeded, next: '/onboarding/plan' });
}
