import { QUEUE_MODES } from './constants.js';

// Starting setup for each business type, ported from frontend/src/config/templates.js.
// Owners can change all of it afterwards in Settings, on any plan.

const NAME_FIELD = { key: 'name', label: 'Full name', type: 'text', required: true, locked: true };
const PHONE_FIELD = { key: 'phone', label: 'Mobile number', type: 'text', required: true, locked: true };

// `services` lists names and timings; each resource lists which services (by position) it handles.
const TEMPLATES = {
  clinic: {
    labels: { resource: 'Doctor', resourcePlural: 'Doctors', service: 'Service' },
    settings: {
      queueMode: QUEUE_MODES.PER_RESOURCE, tokenPrefix: 'A', allowPriority: true, allowAnyAvailable: false, maxTokensPerDay: 200,
      customerFields: [NAME_FIELD, PHONE_FIELD, { key: 'age', label: 'Age', type: 'number', required: true }],
    },
    services: [{ name: 'General consultation', avgMinutes: 12, prefix: 'A' }],
    resources: [{ name: 'Dr. First doctor', services: [0] }],
  },
  bank: {
    labels: { resource: 'Counter', resourcePlural: 'Counters', service: 'Service' },
    settings: {
      queueMode: QUEUE_MODES.PER_SERVICE, tokenPrefix: 'C', allowPriority: false, allowAnyAvailable: false, maxTokensPerDay: 300,
      customerFields: [NAME_FIELD, PHONE_FIELD],
    },
    services: [
      { name: 'Cash deposit and withdrawal', avgMinutes: 6, prefix: 'C' },
      { name: 'Accounts and KYC', avgMinutes: 12, prefix: 'A' },
      { name: 'Loans', avgMinutes: 20, prefix: 'L' },
    ],
    resources: [{ name: 'Counter 1', services: [0, 1, 2] }],
  },
  salon: {
    labels: { resource: 'Stylist', resourcePlural: 'Stylists', service: 'Service' },
    settings: {
      queueMode: QUEUE_MODES.PER_RESOURCE, tokenPrefix: 'S', allowPriority: false, allowAnyAvailable: true, maxTokensPerDay: 80,
      customerFields: [NAME_FIELD, PHONE_FIELD],
    },
    services: [
      { name: 'Haircut', avgMinutes: 30, prefix: 'H' },
      { name: 'Colour', avgMinutes: 60, prefix: 'C' },
    ],
    resources: [{ name: 'First stylist', services: [0, 1] }],
  },
  shared: {
    labels: { resource: 'Counter', resourcePlural: 'Counters', service: 'Service' },
    settings: {
      queueMode: QUEUE_MODES.SHARED, tokenPrefix: 'T', allowPriority: false, allowAnyAvailable: false, maxTokensPerDay: 300,
      customerFields: [NAME_FIELD, PHONE_FIELD],
    },
    services: [{ name: 'General', avgMinutes: 5, prefix: 'T' }],
    resources: [{ name: 'Counter 1', services: [0] }],
  },
};

const TYPE_TO_TEMPLATE = { clinic: 'clinic', bank: 'bank', office: 'bank', salon: 'salon', canteen: 'shared', event: 'shared', other: 'shared' };

// Returns a fresh copy, so callers can change it without affecting other signups.
export function templateFor(type) {
  return structuredClone(TEMPLATES[TYPE_TO_TEMPLATE[type] ?? 'shared']);
}
