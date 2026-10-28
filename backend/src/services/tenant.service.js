import mongoose from 'mongoose';
import { ApiError } from '../utils/ApiError.js';
import { ROLES } from '../utils/constants.js';

// Every query on a business-owned model goes through scoped(Model, businessId), so the
// businessId filter can never be forgotten. The businessId always comes from the session
// (req.businessId), never from the URL or the request body.
//
//   const services = scoped(Service, req.businessId);
//   await services.find({ isActive: true });
//   await services.findById(req.params.id);   // another business's id -> null -> 404

// Updates must not move a document to another business.
function assertNoBusinessIdChange(update = {}) {
  const touched = [update, update.$set, update.$setOnInsert, update.$unset, update.$rename].some((part) => part && 'businessId' in part);
  if (touched) throw ApiError.badRequest('BAD_REQUEST', 'businessId cannot be changed');
}

export function scoped(Model, businessId) {
  if (!businessId) throw ApiError.internal('INTERNAL_ERROR', 'scoped() needs a businessId');
  // businessId is spread last, so a filter can never override it.
  const where = (filter = {}) => ({ ...filter, businessId });

  return {
    find: (filter, ...rest) => Model.find(where(filter), ...rest),
    findOne: (filter, ...rest) => Model.findOne(where(filter), ...rest),
    // Look up by { _id, businessId }, never _id alone. A malformed id simply finds nothing.
    findById: (id, ...rest) => (mongoose.isValidObjectId(id) ? Model.findOne(where({ _id: id }), ...rest) : Promise.resolve(null)),
    exists: (filter) => Model.exists(where(filter)),
    countDocuments: (filter) => Model.countDocuments(where(filter)),
    updateOne: (filter, update, options) => {
      assertNoBusinessIdChange(update);
      return Model.updateOne(where(filter), update, options);
    },
    updateMany: (filter, update, options) => {
      assertNoBusinessIdChange(update);
      return Model.updateMany(where(filter), update, options);
    },
    findOneAndUpdate: (filter, update, options) => {
      assertNoBusinessIdChange(update);
      return Model.findOneAndUpdate(where(filter), update, options);
    },
    deleteOne: (filter) => Model.deleteOne(where(filter)),
    deleteMany: (filter) => Model.deleteMany(where(filter)),
    // A businessId inside the new document is always replaced with the session's.
    create: (docs, options) =>
      Array.isArray(docs) ? Model.create(docs.map((doc) => ({ ...doc, businessId })), options) : Model.create({ ...docs, businessId }),
    insertMany: (docs, options) => Model.insertMany(docs.map((doc) => ({ ...doc, businessId })), options),
  };
}

/* ---------------------------------------------------- staff limits */
// Owners and managers can use every resource in their business. Staff can only use the
// one they are assigned to. The staff service functions (Phase 9) call these.

export const canUseAnyResource = (user) => user.role === ROLES.OWNER || user.role === ROLES.MANAGER;

export function assertCanUseResource(user, resourceId) {
  if (canUseAnyResource(user)) return;
  if (!user.resourceId || String(user.resourceId) !== String(resourceId)) {
    throw ApiError.forbidden('ACCESS_DENIED', 'You can only manage the counter or doctor you are assigned to');
  }
}

// A filter limiting a resource query to what this user may see.
export const resourceFilterFor = (user) => (canUseAnyResource(user) ? {} : { _id: user.resourceId ?? null });
