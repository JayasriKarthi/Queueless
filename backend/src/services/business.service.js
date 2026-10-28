import mongoose from 'mongoose';
import { Service } from '../models/Service.js';
import { Resource } from '../models/Resource.js';
import { Token } from '../models/Token.js';
import { User } from '../models/User.js';
import { StaffInvite } from '../models/StaffInvite.js';
import { ApiError } from '../utils/ApiError.js';
import { ACTIVE_STATUSES, LOCKED_FIELD_KEYS } from '../utils/constants.js';
import { templateFor } from '../utils/templates.js';
import { logActivity } from './activity.service.js';
import { activeHistory } from './slug.service.js';
import { publicBranding } from './branding.service.js';

const { ObjectId } = mongoose.Types;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Everything the Settings page needs in one response.
export async function businessView(business) {
  return {
    business,
    slugHistory: await activeHistory(business._id),
    effectiveBranding: publicBranding(business),
  };
}

/* ------------------------------------------------------- onboarding */

// Welcome step. If the type changed and the business has never had a customer, start again
// from the new type's template. Otherwise only the daily-customers answer is saved.
export async function completeWelcome(business, { type, dailyCustomers }, actorId) {
  const changeType = type && type !== business.type && !(await Token.exists({ businessId: business._id }));

  if (!changeType) {
    if (dailyCustomers !== undefined) business.dailyCustomers = dailyCustomers;
    await business.save();
    return { business, reseeded: false };
  }

  const template = templateFor(type);
  const businessId = business._id;
  const services = template.services.map((s, i) => ({ _id: new ObjectId(), businessId, sortOrder: i, ...s }));
  const resources = template.resources.map((r) => ({ businessId, name: r.name, serviceIds: r.services.map((i) => services[i]._id) }));

  await mongoose.connection.transaction(async (session) => {
    await Service.deleteMany({ businessId }, { session });
    await Resource.deleteMany({ businessId }, { session });
    // Old resources are gone, so nobody can stay assigned to one.
    await User.updateMany({ businessId, resourceId: { $ne: null } }, { $set: { resourceId: null } }, { session });
    await StaffInvite.updateMany({ businessId, resourceId: { $exists: true } }, { $unset: { resourceId: 1 } }, { session });
    await Service.insertMany(services, { session });
    await Resource.insertMany(resources, { session });

    business.type = type;
    business.labels = template.labels;
    business.settings = template.settings;
    if (dailyCustomers !== undefined) business.dailyCustomers = dailyCustomers;
    await business.save({ session });
    await logActivity({ businessId, actorId, kind: 'settings', text: `Business set up from the ${type} template` }, session);
  });
  return { business, reseeded: true };
}

/* --------------------------------------------------------- settings */

// Name and phone always stay text fields, required, and locked.
const normaliseFields = (fields) =>
  fields.map((f) => (LOCKED_FIELD_KEYS.includes(f.key) ? { ...f, type: 'text', required: true, locked: true } : { ...f, locked: false }));

// Saves any mix of the Settings tabs. Plans never block saving a setting.
export async function updateSettings(business, body, actorId) {
  const { confirm, ...changes } = body;
  const before = business.toObject();

  // Changing how lines work while people are waiting needs the owner's confirmation.
  const newMode = changes.settings?.queueMode;
  if (newMode && newMode !== business.settings.queueMode && !confirm) {
    const count = await Token.countDocuments({ businessId: business._id, status: { $in: ACTIVE_STATUSES } });
    if (count > 0) {
      throw ApiError.conflict(
        'ACTIVE_TOKENS',
        `${count} ${count === 1 ? 'person is' : 'people are'} in line right now. They keep their place, but new customers will join the new way. Send confirm: true to continue.`,
        { count },
      );
    }
  }

  if (changes.name !== undefined) business.name = changes.name;
  if (changes.type !== undefined) business.type = changes.type;
  if (changes.hours !== undefined) business.hours = changes.hours;
  // Partial updates: only the keys sent are changed inside these groups.
  for (const group of ['contact', 'labels', 'notifications']) {
    if (changes[group]) business.set(group, { ...before[group], ...changes[group] });
  }
  if (changes.settings) {
    const { customerFields, ...rest } = changes.settings;
    business.set('settings', { ...before.settings, ...rest, ...(customerFields && { customerFields: normaliseFields(customerFields) }) });
  }

  // Setup guide progress, as the frontend tracks it.
  if (changes.settings?.customerFields && !same(business.settings.customerFields, before.settings.customerFields)) business.setup.joinFormCustomised = true;
  if (changes.hours && !same(business.toObject().hours, before.hours)) business.setup.hoursSet = true;

  await business.save();
  const changed = Object.keys(changes).join(', ');
  await logActivity({ businessId: business._id, actorId, kind: 'settings', text: `Settings updated: ${changed}` });
  return business;
}
