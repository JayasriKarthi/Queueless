// Plan limits and feature flags. Prices are INR placeholders.
// Customisation is never gated: plans only cap usage and unlock extras.
export const YEARLY_DISCOUNT = 0.2;

export const FEATURE_LABELS = {
  tvDisplay: 'TV display',
  smsAlerts: 'SMS alerts',
  browserAlerts: 'Browser alerts',
  removeBranding: 'Remove "Powered by QueueLess"',
  csvExport: 'CSV export',
  priorityQueues: 'Priority queues',
  advancedAnalytics: 'Advanced analytics',
  customDomain: 'Custom domain',
  apiAccess: 'API access',
  sso: 'Single sign-on',
};

export const PLANS = [
  {
    id: 'free',
    name: 'Free',
    tagline: 'For a single counter getting started.',
    priceMonthly: 0,
    trialDays: 0,
    limits: { counters: 1, tokensPerDay: 50, staffSeats: 1, locations: 1, smsPerMonth: 0 },
    features: {},
    highlights: ['1 counter', '50 tokens a day', '1 staff seat', 'QR code and join link', 'Staff console', 'Basic analytics', '"Powered by QueueLess" on public pages'],
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'For busy single-location teams.',
    priceMonthly: 999,
    trialDays: 14,
    limits: { counters: 5, tokensPerDay: Infinity, staffSeats: 3, locations: 1, smsPerMonth: 100 },
    features: { tvDisplay: true, browserAlerts: true, smsAlerts: true, removeBranding: true },
    highlights: ['5 counters', 'Unlimited tokens', '3 staff seats', 'TV display', 'Browser alerts', '100 SMS a month', 'Remove branding'],
  },
  {
    id: 'business',
    name: 'Business',
    tagline: 'For growing teams with several locations.',
    priceMonthly: 2999,
    trialDays: 14,
    popular: true,
    limits: { counters: 25, tokensPerDay: Infinity, staffSeats: 15, locations: 5, smsPerMonth: 500 },
    features: { tvDisplay: true, browserAlerts: true, smsAlerts: true, removeBranding: true, priorityQueues: true, advancedAnalytics: true, csvExport: true, apiAccess: true },
    highlights: ['Everything in Pro', '5 locations', '25 counters', '15 staff seats', 'Priority queues', 'Advanced analytics and CSV export', 'API access', 'Priority support'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'For large organisations and public services.',
    priceMonthly: null,
    trialDays: 0,
    limits: { counters: Infinity, tokensPerDay: Infinity, staffSeats: Infinity, locations: Infinity, smsPerMonth: Infinity },
    features: { tvDisplay: true, browserAlerts: true, smsAlerts: true, removeBranding: true, priorityQueues: true, advancedAnalytics: true, csvExport: true, apiAccess: true, customDomain: true, sso: true },
    highlights: ['Everything in Business', 'Unlimited locations', 'Custom domain', 'SSO and roles', 'Audit logs', 'Uptime SLA', 'Dedicated onboarding'],
  },
];

export const COMPARISON_ROWS = [
  { group: 'Usage', label: 'Counters', get: (p) => p.limits.counters },
  { group: 'Usage', label: 'Tokens per day', get: (p) => p.limits.tokensPerDay },
  { group: 'Usage', label: 'Staff seats', get: (p) => p.limits.staffSeats },
  { group: 'Usage', label: 'Locations', get: (p) => p.limits.locations },
  { group: 'Usage', label: 'SMS per month', get: (p) => p.limits.smsPerMonth },
  { group: 'Core', label: 'QR code and join link', get: () => true },
  { group: 'Core', label: 'Staff console', get: () => true },
  { group: 'Core', label: 'Full customisation', get: () => true },
  { group: 'Core', label: 'Basic analytics', get: () => true },
  ...['tvDisplay', 'browserAlerts', 'smsAlerts', 'removeBranding', 'priorityQueues', 'advancedAnalytics', 'csvExport', 'apiAccess', 'customDomain', 'sso'].map((key) => ({
    group: 'Extras',
    label: FEATURE_LABELS[key],
    get: (p) => Boolean(p.features[key]),
  })),
];

export const getPlan = (id) => PLANS.find((p) => p.id === id) ?? PLANS[0];

export function planPrice(plan, cycle) {
  if (plan.priceMonthly == null) return null;
  return cycle === 'yearly' ? Math.round(plan.priceMonthly * (1 - YEARLY_DISCOUNT)) : plan.priceMonthly;
}

export const hasFeature = (planId, feature) => Boolean(getPlan(planId).features[feature]);
export const planLimit = (planId, key) => getPlan(planId).limits[key];

// The cheapest plan that unlocks a feature, used in upgrade prompts.
export const planFor = (feature) => PLANS.find((p) => p.features[feature]) ?? PLANS[PLANS.length - 1];
