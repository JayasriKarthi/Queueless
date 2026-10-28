import { env } from '../config/env.js';

// Shared values copied from frontend/src/config/constants.js and plans.js.
// Keep both sides in sync until they move into one shared package.

const deepFreeze = (value) => {
  if (value && typeof value === 'object') Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
};

/* ------------------------------------------------------------ users */

export const ROLES = deepFreeze({ OWNER: 'owner', MANAGER: 'manager', STAFF: 'staff' });
export const STAFF_ROLES = deepFreeze([ROLES.STAFF, ROLES.MANAGER]);

/* -------------------------------------------------------- businesses */

export const RESERVED_SLUGS = deepFreeze(['admin', 'login', 'signup', 'staff', 'display', 'pricing', 'enterprise', 'onboarding', 'accept-invite', 'api', 'contact-sales']);

export const BUSINESS_TYPES = deepFreeze(['clinic', 'bank', 'salon', 'canteen', 'office', 'event', 'other']);

export const DAILY_CUSTOMER_RANGES = deepFreeze(['Under 50', '50 to 200', '200 to 500', '500 to 2,000', 'More than 2,000']);

export const QUEUE_MODES = deepFreeze({
  SHARED: 'shared',
  PER_SERVICE: 'per_service',
  PER_RESOURCE: 'per_resource',
});

export const FIELD_TYPES = deepFreeze(['text', 'number', 'email', 'select', 'textarea']);

// Join-form fields every business must keep.
export const LOCKED_FIELD_KEYS = deepFreeze(['name', 'phone']);

export const DAYS = deepFreeze(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);

/* ------------------------------------------------------------ tokens */

export const TOKEN_STATUS = deepFreeze({
  WAITING: 'WAITING',
  CALLED: 'CALLED',
  SERVING: 'SERVING',
  DONE: 'DONE',
  NO_SHOW: 'NO_SHOW',
  CANCELLED: 'CANCELLED',
});

export const ACTIVE_STATUSES = deepFreeze([TOKEN_STATUS.WAITING, TOKEN_STATUS.CALLED, TOKEN_STATUS.SERVING]);

export const TOKEN_SOURCES = deepFreeze({ QR: 'qr', WALK_IN: 'walk-in' });

/* ---------------------------------------------------------- timings */

export const ALMOST_THRESHOLD = 3; // people ahead when the "almost your turn" alert fires
export const NO_SHOW_MINUTES = 5; // default; each business can change it in Queue rules
export const INVITE_EXPIRY_DAYS = env.INVITE_EXPIRY_DAYS; // 7 unless .env says otherwise
export const SLUG_REDIRECT_DAYS = env.SLUG_REDIRECT_DAYS; // 90 unless .env says otherwise
export const PIN_MAX_ATTEMPTS = 5;
export const PIN_LOCK_SECONDS = 30;
export const DAY_MS = 86400000;

/* ------------------------------------------------------------- plans */

// Customisation is never gated: plans only cap usage and unlock extras. Prices are INR.
export const YEARLY_DISCOUNT = 0.2;

export const FEATURES = deepFreeze([
  'tvDisplay', 'browserAlerts', 'smsAlerts', 'removeBranding', 'priorityQueues',
  'advancedAnalytics', 'csvExport', 'apiAccess', 'customDomain', 'sso',
]);

export const PLANS = deepFreeze([
  {
    id: 'free',
    name: 'Free',
    priceMonthly: 0,
    trialDays: 0,
    limits: { counters: 1, tokensPerDay: 50, staffSeats: 1, locations: 1, smsPerMonth: 0 },
    features: {},
  },
  {
    id: 'pro',
    name: 'Pro',
    priceMonthly: 999,
    trialDays: 14,
    limits: { counters: 5, tokensPerDay: Infinity, staffSeats: 3, locations: 1, smsPerMonth: 100 },
    features: { tvDisplay: true, browserAlerts: true, smsAlerts: true, removeBranding: true },
  },
  {
    id: 'business',
    name: 'Business',
    priceMonthly: 2999,
    trialDays: 14,
    limits: { counters: 25, tokensPerDay: Infinity, staffSeats: 15, locations: 5, smsPerMonth: 500 },
    features: { tvDisplay: true, browserAlerts: true, smsAlerts: true, removeBranding: true, priorityQueues: true, advancedAnalytics: true, csvExport: true, apiAccess: true },
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    priceMonthly: null, // custom pricing through sales
    trialDays: 0,
    limits: { counters: Infinity, tokensPerDay: Infinity, staffSeats: Infinity, locations: Infinity, smsPerMonth: Infinity },
    features: { tvDisplay: true, browserAlerts: true, smsAlerts: true, removeBranding: true, priorityQueues: true, advancedAnalytics: true, csvExport: true, apiAccess: true, customDomain: true, sso: true },
  },
]);

export const PLAN_IDS = deepFreeze(PLANS.map((p) => p.id));

export const getPlan = (id) => PLANS.find((p) => p.id === id) ?? PLANS[0];
// hasFeature(business, 'csvExport') or hasFeature('pro', 'csvExport').
export const hasFeature = (businessOrPlanId, feature) =>
  Boolean(getPlan(typeof businessOrPlanId === 'string' ? businessOrPlanId : businessOrPlanId?.plan).features[feature]);

// Readable names for upgrade messages ("CSV export is on the Business plan").
export const FEATURE_LABELS = deepFreeze({
  tvDisplay: 'The TV display',
  browserAlerts: 'Browser alerts',
  smsAlerts: 'SMS alerts',
  removeBranding: 'Removing "Powered by QueueLess"',
  priorityQueues: 'Priority queues',
  advancedAnalytics: 'Advanced analytics',
  csvExport: 'CSV export',
  apiAccess: 'API access',
  customDomain: 'A custom domain',
  sso: 'Single sign-on',
});
export const planLimit = (planId, key) => getPlan(planId).limits[key];

// Monthly price for a billing cycle; yearly is 20% cheaper. null means custom pricing.
export function planPrice(planId, cycle = 'monthly') {
  const { priceMonthly } = getPlan(planId);
  if (priceMonthly == null) return null;
  return cycle === 'yearly' ? Math.round(priceMonthly * (1 - YEARLY_DISCOUNT)) : priceMonthly;
}

// The cheapest plan that includes a feature, for upgrade prompts.
export const planForFeature = (feature) => PLANS.find((p) => p.features[feature]) ?? PLANS[PLANS.length - 1];

// JSON has no Infinity (it becomes null), so send "unlimited" limits as null explicitly.
export function planForClient(planId) {
  const plan = getPlan(planId);
  return {
    ...plan,
    limits: Object.fromEntries(Object.entries(plan.limits).map(([key, value]) => [key, value === Infinity ? null : value])),
  };
}
