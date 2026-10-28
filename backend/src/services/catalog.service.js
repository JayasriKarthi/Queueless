import mongoose from 'mongoose';
import { Service } from '../models/Service.js';
import { Resource } from '../models/Resource.js';
import { Token } from '../models/Token.js';
import { User } from '../models/User.js';
import { StaffInvite } from '../models/StaffInvite.js';
import { ApiError } from '../utils/ApiError.js';
import { QUEUE_MODES, STAFF_ROLES, TOKEN_STATUS, ACTIVE_STATUSES } from '../utils/constants.js';
import { scoped } from './tenant.service.js';
import { logActivity } from './activity.service.js';

// Services (what customers queue for) and resources (the doctors, counters, or stylists
// who serve them). Every query is limited to the owner's business through scoped().

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const listFilter = ({ status, q }) => ({
  ...(status === 'active' && { isActive: true }),
  ...(status === 'inactive' && { isActive: false }),
  ...(q && { name: { $regex: escapeRegex(q), $options: 'i' } }),
});
const people = (n) => `${n} ${n === 1 ? 'person is' : 'people are'}`;
const names = (docs) => docs.map((d) => d.name).join(', ');
const brief = (docs) => docs.map((d) => ({ id: d.id, name: d.name }));
const has = (list, id) => list.some((x) => x.equals(id));

// Loads documents by id from this business only. Another business's id counts as not found.
async function loadOwn(Model, businessId, ids, label) {
  if (!ids.length) return [];
  const docs = await scoped(Model, businessId).find({ _id: { $in: ids } });
  if (docs.length !== ids.length) throw ApiError.notFound('NOT_FOUND', `One or more ${label} were not found`);
  return docs;
}

const waitingTokens = (businessId) =>
  Token.find({ businessId, status: TOKEN_STATUS.WAITING }).select('queueKey serviceId resourceId').lean();

// People in line that this resource can call, depending on the queue mode.
function waitingCountFor(business, resource, waiting) {
  const handles = (t) => has(resource.serviceIds, t.serviceId);
  switch (business.settings.queueMode) {
    case QUEUE_MODES.PER_RESOURCE:
      return waiting.filter((t) => t.queueKey === `res:${resource.id}` || (t.queueKey === 'res:any' && handles(t))).length;
    case QUEUE_MODES.PER_SERVICE:
      return waiting.filter(handles).length;
    default:
      return waiting.length;
  }
}

// Every resource must keep at least one service, or nobody could ever reach it.
function assertNoneStranded(resources, removedServiceIds) {
  const stranded = resources.filter((r) => r.serviceIds.every((id) => removedServiceIds.some((removed) => id.equals(removed))));
  if (stranded.length) {
    throw ApiError.badRequest(
      'RESOURCE_NEEDS_SERVICE',
      `${names(stranded)} would have no services left. Give ${stranded.length === 1 ? 'it' : 'them'} another service first.`,
      { resources: brief(stranded) },
    );
  }
}

/* ------------------------------------------------------------ services */

export async function listServices(business, query) {
  const [services, resources, waiting] = await Promise.all([
    scoped(Service, business._id).find(listFilter(query)).sort({ sortOrder: 1, createdAt: 1 }),
    scoped(Resource, business._id).find().select('name serviceIds'),
    waitingTokens(business._id),
  ]);
  return services.map((s) => ({
    ...s.toJSON(),
    handledBy: brief(resources.filter((r) => has(r.serviceIds, s._id))),
    waiting: waiting.filter((t) => s._id.equals(t.serviceId)).length,
  }));
}

export async function createService(business, { handledBy, ...fields }, actorId) {
  await loadOwn(Resource, business._id, handledBy, 'counters or doctors');
  const last = await scoped(Service, business._id).findOne().sort({ sortOrder: -1 }).select('sortOrder');

  let service;
  await mongoose.connection.transaction(async (session) => {
    [service] = await Service.create([{ ...fields, businessId: business._id, sortOrder: (last?.sortOrder ?? -1) + 1 }], { session });
    if (handledBy.length) {
      await Resource.updateMany({ _id: { $in: handledBy }, businessId: business._id }, { $addToSet: { serviceIds: service._id } }, { session });
    }
    await logActivity({ businessId: business._id, actorId, kind: 'settings', text: `Added service "${service.name}"` }, session);
  });
  return service;
}

export async function updateService(business, id, { handledBy, ...fields }, actorId) {
  const service = await scoped(Service, business._id).findById(id);
  if (!service) throw ApiError.notFound('NOT_FOUND', 'Service not found');

  // handledBy is the full new list of resources for this service.
  let removeFrom = [];
  if (handledBy) {
    await loadOwn(Resource, business._id, handledBy, 'counters or doctors');
    const current = await scoped(Resource, business._id).find({ serviceIds: service._id });
    removeFrom = current.filter((r) => !handledBy.includes(r.id));
    assertNoneStranded(removeFrom, [service._id]);
  }

  await mongoose.connection.transaction(async (session) => {
    Object.assign(service, fields);
    await service.save({ session });
    if (handledBy) {
      await Resource.updateMany({ _id: { $in: handledBy }, businessId: business._id }, { $addToSet: { serviceIds: service._id } }, { session });
      await Resource.updateMany({ _id: { $in: removeFrom.map((r) => r._id) }, businessId: business._id }, { $pull: { serviceIds: service._id } }, { session });
    }
    await logActivity({ businessId: business._id, actorId, kind: 'settings', text: `Updated service "${service.name}"` }, session);
  });
  return service;
}

export async function setServicesActive(business, ids, isActive, actorId) {
  await loadOwn(Service, business._id, ids, 'services');
  await scoped(Service, business._id).updateMany({ _id: { $in: ids } }, { $set: { isActive } });
  await logActivity({ businessId: business._id, actorId, kind: 'settings', text: `${isActive ? 'Activated' : 'Deactivated'} ${ids.length} service${ids.length === 1 ? '' : 's'}` });
}

export async function deleteServices(business, ids, actorId) {
  const services = await loadOwn(Service, business._id, ids, 'services');
  const total = await scoped(Service, business._id).countDocuments();
  if (total - ids.length < 1) throw ApiError.badRequest('LAST_SERVICE', 'Keep at least one service so customers can join.');

  const inUse = await Token.countDocuments({ businessId: business._id, serviceId: { $in: ids }, status: { $in: ACTIVE_STATUSES } });
  if (inUse) {
    throw ApiError.conflict('SERVICE_IN_USE', `${people(inUse)} waiting or being served for ${names(services)}. Deactivate it instead, and delete it once the line is empty.`, { count: inUse });
  }

  const affected = await scoped(Resource, business._id).find({ serviceIds: { $in: ids } });
  assertNoneStranded(affected, services.map((s) => s._id));

  // Past tokens keep their serviceId, so history and analytics stay intact.
  await mongoose.connection.transaction(async (session) => {
    await Service.deleteMany({ _id: { $in: ids }, businessId: business._id }, { session });
    await Resource.updateMany({ businessId: business._id }, { $pull: { serviceIds: { $in: services.map((s) => s._id) } } }, { session });
    await logActivity({ businessId: business._id, actorId, kind: 'settings', text: `Deleted ${ids.length === 1 ? `service "${services[0].name}"` : `${ids.length} services`}` }, session);
  });
}

/* ----------------------------------------------------------- resources */

export async function listResources(business, query) {
  const businessId = business._id;
  const [resources, staff, current, waiting] = await Promise.all([
    scoped(Resource, businessId).find(listFilter(query)).sort({ createdAt: 1 }),
    User.find({ businessId, role: { $in: STAFF_ROLES }, status: 'active', resourceId: { $ne: null } }).select('name resourceId'),
    Token.find({ businessId, status: { $in: [TOKEN_STATUS.CALLED, TOKEN_STATUS.SERVING] }, resourceId: { $ne: null } })
      .sort({ calledAt: -1 })
      .select('code status resourceId calledAt'),
    waitingTokens(businessId),
  ]);
  return resources.map((r) => {
    const now = current.find((t) => r._id.equals(t.resourceId));
    return {
      ...r.toJSON(),
      staff: brief(staff.filter((u) => r._id.equals(u.resourceId))),
      current: now ? { id: now.id, code: now.code, status: now.status, calledAt: now.calledAt } : null,
      waiting: waitingCountFor(business, r, waiting),
    };
  });
}

export async function createResource(business, data, actorId) {
  await loadOwn(Service, business._id, data.serviceIds, 'services');
  const resource = await scoped(Resource, business._id).create(data);
  await logActivity({ businessId: business._id, actorId, kind: 'settings', text: `Added ${business.labels.resource.toLowerCase()} "${resource.name}"` });
  return resource;
}

export async function updateResource(business, id, data, actorId) {
  const resource = await scoped(Resource, business._id).findById(id);
  if (!resource) throw ApiError.notFound('NOT_FOUND', `${business.labels.resource} not found`);
  if (data.serviceIds) await loadOwn(Service, business._id, data.serviceIds, 'services');
  Object.assign(resource, data);
  await resource.save();
  await logActivity({ businessId: business._id, actorId, kind: 'settings', text: `Updated ${business.labels.resource.toLowerCase()} "${resource.name}"` });
  return resource;
}

export async function setResourcesActive(business, ids, isActive, actorId) {
  await loadOwn(Resource, business._id, ids, `${business.labels.resourcePlural.toLowerCase()}`);
  await scoped(Resource, business._id).updateMany({ _id: { $in: ids } }, { $set: { isActive } });
  await logActivity({ businessId: business._id, actorId, kind: 'settings', text: `${isActive ? 'Activated' : 'Deactivated'} ${ids.length} ${(ids.length === 1 ? business.labels.resource : business.labels.resourcePlural).toLowerCase()}` });
}

export async function deleteResources(business, ids, actorId) {
  const { resource: one, resourcePlural: many } = business.labels;
  const resources = await loadOwn(Resource, business._id, ids, many.toLowerCase());
  const total = await scoped(Resource, business._id).countDocuments();
  if (total - ids.length < 1) throw ApiError.badRequest('LAST_RESOURCE', `Keep at least one ${one.toLowerCase()} to serve customers.`);

  // Someone being served there, or waiting in that resource's own line.
  const inUse = await Token.countDocuments({
    businessId: business._id,
    status: { $in: ACTIVE_STATUSES },
    $or: [{ resourceId: { $in: ids } }, { queueKey: { $in: ids.map((id) => `res:${id}`) } }],
  });
  if (inUse) {
    throw ApiError.conflict('RESOURCE_IN_USE', `${people(inUse)} waiting for or being served by ${names(resources)}. Deactivate instead, and delete once the line is empty.`, { count: inUse });
  }

  await mongoose.connection.transaction(async (session) => {
    await Resource.deleteMany({ _id: { $in: ids }, businessId: business._id }, { session });
    // Staff and pending invites assigned here are unassigned, not deleted.
    await User.updateMany({ businessId: business._id, resourceId: { $in: ids } }, { $set: { resourceId: null } }, { session });
    await StaffInvite.updateMany({ businessId: business._id, resourceId: { $in: ids } }, { $unset: { resourceId: 1 } }, { session });
    await logActivity({ businessId: business._id, actorId, kind: 'settings', text: `Deleted ${ids.length === 1 ? `${one.toLowerCase()} "${resources[0].name}"` : `${ids.length} ${many.toLowerCase()}`}` }, session);
  });
}

// How many resources a request would switch on, for the plan-limit check.
export async function countActivations(business, ids) {
  return scoped(Resource, business._id).countDocuments({ _id: { $in: ids }, isActive: false });
}
