import { Stethoscope, Landmark, Scissors, UtensilsCrossed, Building2, Ticket, Store } from 'lucide-react';

export const RESERVED_SLUGS = ['admin', 'login', 'signup', 'staff', 'display', 'pricing', 'enterprise', 'onboarding', 'accept-invite', 'api', 'contact-sales'];

export const BUSINESS_TYPES = [
  { id: 'clinic', label: 'Clinic', icon: Stethoscope, blurb: 'One line per doctor' },
  { id: 'bank', label: 'Bank', icon: Landmark, blurb: 'One line per service' },
  { id: 'salon', label: 'Salon', icon: Scissors, blurb: 'Pick a stylist or any available' },
  { id: 'canteen', label: 'Canteen', icon: UtensilsCrossed, blurb: 'One shared line' },
  { id: 'office', label: 'Office', icon: Building2, blurb: 'Government or front office desks' },
  { id: 'event', label: 'Event', icon: Ticket, blurb: 'Entry gates and help desks' },
  { id: 'other', label: 'Other', icon: Store, blurb: 'Start simple and adjust' },
];

export const DAILY_CUSTOMER_RANGES = ['Under 50', '50 to 200', '200 to 500', '500 to 2,000', 'More than 2,000'];

export const QUEUE_MODES = {
  shared: { label: 'One shared line', short: 'Shared', help: 'Everyone joins one line and the next free counter calls the next person. Best for canteens and pickups.' },
  per_service: { label: 'One line per service', short: 'Per service', help: 'Customers pick a service. Each counter calls people waiting for the services it handles. Best for banks and offices.' },
  per_resource: { label: 'One line per person or counter', short: 'Per resource', help: 'Customers pick a doctor, stylist, or desk and wait in that line. Best for clinics and salons.' },
};

export const TOKEN_STATUS = {
  WAITING: { label: 'Waiting', tone: 'info' },
  CALLED: { label: 'Called', tone: 'attention' },
  SERVING: { label: 'Serving', tone: 'success' },
  DONE: { label: 'Done', tone: 'neutral' },
  NO_SHOW: { label: 'No-show', tone: 'critical' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral' },
};
export const ACTIVE_STATUSES = ['WAITING', 'CALLED', 'SERVING'];

export const FIELD_TYPES = [
  { id: 'text', label: 'Short text' },
  { id: 'number', label: 'Number' },
  { id: 'email', label: 'Email' },
  { id: 'select', label: 'Dropdown' },
  { id: 'textarea', label: 'Long text' },
];

export const DAYS = [
  { id: 'mon', label: 'Monday' }, { id: 'tue', label: 'Tuesday' }, { id: 'wed', label: 'Wednesday' },
  { id: 'thu', label: 'Thursday' }, { id: 'fri', label: 'Friday' }, { id: 'sat', label: 'Saturday' }, { id: 'sun', label: 'Sunday' },
];

export const ALMOST_THRESHOLD = 3;
export const NO_SHOW_MINUTES = 5;
export const INVITE_EXPIRY_DAYS = 7;
export const SLUG_REDIRECT_DAYS = 90;
export const PIN_MAX_ATTEMPTS = 5;
export const PIN_LOCK_SECONDS = 30;
export const DAY_MS = 86400000;

export const DEMO_PASSWORD = 'demo1234';
export const STORE_KEYS = { auth: 'ql-auth', business: 'ql-business', queue: 'ql-queue', ui: 'ql-ui' };
