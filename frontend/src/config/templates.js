import { uid } from '../lib/formatters';

const NAME_FIELD = { key: 'name', label: 'Full name', type: 'text', required: true, locked: true };
const PHONE_FIELD = { key: 'phone', label: 'Mobile number', type: 'text', required: true, locked: true };

export const DEFAULT_HOURS = {
  mon: { open: true, from: '09:00', to: '18:00' },
  tue: { open: true, from: '09:00', to: '18:00' },
  wed: { open: true, from: '09:00', to: '18:00' },
  thu: { open: true, from: '09:00', to: '18:00' },
  fri: { open: true, from: '09:00', to: '18:00' },
  sat: { open: true, from: '10:00', to: '14:00' },
  sun: { open: false, from: '10:00', to: '14:00' },
};

const svc = (name, avgMinutes, prefix) => ({ id: uid('svc'), name, avgMinutes, prefix, isActive: true });
const res = (name, serviceIds) => ({ id: uid('res'), name, serviceIds, isActive: true, isPaused: false });

const TEMPLATES = {
  clinic: () => {
    const services = [svc('General consultation', 12, 'A')];
    return {
      labels: { resource: 'Doctor', resourcePlural: 'Doctors', service: 'Service' },
      settings: { queueMode: 'per_resource', tokenPrefix: 'A', allowPriority: true, allowAnyAvailable: false, maxTokensPerDay: 200, noShowMinutes: 5,
        customerFields: [NAME_FIELD, PHONE_FIELD, { key: 'age', label: 'Age', type: 'number', required: true }] },
      services,
      resources: [res('Dr. First doctor', [services[0].id])],
    };
  },
  bank: () => {
    const services = [svc('Cash deposit and withdrawal', 6, 'C'), svc('Accounts and KYC', 12, 'A'), svc('Loans', 20, 'L')];
    return {
      labels: { resource: 'Counter', resourcePlural: 'Counters', service: 'Service' },
      settings: { queueMode: 'per_service', tokenPrefix: 'C', allowPriority: false, allowAnyAvailable: false, maxTokensPerDay: 300, noShowMinutes: 5,
        customerFields: [NAME_FIELD, PHONE_FIELD] },
      services,
      resources: [res('Counter 1', services.map((s) => s.id))],
    };
  },
  salon: () => {
    const services = [svc('Haircut', 30, 'H'), svc('Colour', 60, 'C')];
    return {
      labels: { resource: 'Stylist', resourcePlural: 'Stylists', service: 'Service' },
      settings: { queueMode: 'per_resource', tokenPrefix: 'S', allowPriority: false, allowAnyAvailable: true, maxTokensPerDay: 80, noShowMinutes: 5,
        customerFields: [NAME_FIELD, PHONE_FIELD] },
      services,
      resources: [res('First stylist', services.map((s) => s.id))],
    };
  },
  shared: () => {
    const services = [svc('General', 5, 'T')];
    return {
      labels: { resource: 'Counter', resourcePlural: 'Counters', service: 'Service' },
      settings: { queueMode: 'shared', tokenPrefix: 'T', allowPriority: false, allowAnyAvailable: false, maxTokensPerDay: 300, noShowMinutes: 5,
        customerFields: [NAME_FIELD, PHONE_FIELD] },
      services,
      resources: [res('Counter 1', [services[0].id])],
    };
  },
};

const TYPE_TO_TEMPLATE = { clinic: 'clinic', bank: 'bank', office: 'bank', salon: 'salon', canteen: 'shared', event: 'shared', other: 'shared' };

export function templateFor(type) {
  return TEMPLATES[TYPE_TO_TEMPLATE[type] ?? 'shared']();
}

export const LOCKED_FIELD_KEYS = ['name', 'phone'];
