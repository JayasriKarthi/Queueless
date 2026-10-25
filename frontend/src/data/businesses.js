import { DEFAULT_HOURS } from '../config/templates';
import { DAY_MS } from '../config/constants';

const NAME = { key: 'name', label: 'Full name', type: 'text', required: true, locked: true };
const PHONE = { key: 'phone', label: 'Mobile number', type: 'text', required: true, locked: true };

// Simple original SVG marks so each demo business looks distinct.
const svgLogo = (color, shape) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="${color}"/>${shape}</svg>`,
  )}`;

const allDay = Object.fromEntries(Object.keys(DEFAULT_HOURS).map((d) => [d, { open: true, from: '08:00', to: '21:00' }]));

const baseSetup = { joinFormCustomised: true, brandingSet: true, hoursSet: true, qrPrinted: true, testTokenRun: true, slugConfirmed: true };

export function seedBusinesses(now = Date.now()) {
  return [
    {
      id: 'biz_citycare',
      name: 'City Care Clinic',
      slug: 'city-care',
      type: 'clinic',
      plan: 'free',
      billingCycle: 'monthly',
      isLive: true,
      isOpen: true,
      createdAt: now - 120 * DAY_MS,
      contact: { email: 'frontdesk@citycare.example', phone: '9845012345', address: '14 Residency Road, Bengaluru' },
      dailyCustomers: '50 to 200',
      labels: { resource: 'Doctor', resourcePlural: 'Doctors', service: 'Service' },
      branding: {
        logoDataUrl: svgLogo('#2563EB', '<path d="M27 16h10v11h11v10H37v11H27V37H16V27h11z" fill="#fff"/>'),
        brandColor: '#2563EB',
        welcomeMessage: 'Welcome to City Care. Join the line and relax, we will alert you before your turn.',
        hidePoweredBy: false,
      },
      slugHistory: [],
      settings: {
        queueMode: 'per_resource', tokenPrefix: 'A', allowPriority: true, allowAnyAvailable: false, maxTokensPerDay: 200, noShowMinutes: 5,
        customerFields: [NAME, PHONE, { key: 'age', label: 'Age', type: 'number', required: true }, { key: 'reason', label: 'Reason for visit', type: 'select', required: false, options: ['Fever or cold', 'Follow-up', 'Check-up', 'Other'] }],
      },
      services: [
        { id: 'svc_cc_gen', name: 'General consultation', avgMinutes: 12, prefix: 'A', isActive: true },
        { id: 'svc_cc_child', name: 'Child health', avgMinutes: 15, prefix: 'B', isActive: true },
        { id: 'svc_cc_skin', name: 'Skin care', avgMinutes: 10, prefix: 'D', isActive: true },
      ],
      resources: [
        { id: 'res_cc_1', name: 'Dr. Ananya Rao', serviceIds: ['svc_cc_gen'], isActive: true, isPaused: false },
        { id: 'res_cc_2', name: 'Dr. Vikram Menon', serviceIds: ['svc_cc_child'], isActive: true, isPaused: false },
        { id: 'res_cc_3', name: 'Dr. Farah Siddiqui', serviceIds: ['svc_cc_skin'], isActive: true, isPaused: false },
      ],
      hours: allDay,
      notifications: { almostSms: false, almostBrowser: true, dailySummary: true, staffJoins: true },
      setup: { joinFormCustomised: false, brandingSet: false, hoursSet: false, qrPrinted: false, testTokenRun: false, slugConfirmed: true },
      smsUsed: 0,
    },
    {
      id: 'biz_unitedbank',
      name: 'United Bank, MG Road',
      slug: 'united-bank',
      type: 'bank',
      plan: 'business',
      billingCycle: 'yearly',
      isLive: true,
      isOpen: true,
      createdAt: now - 300 * DAY_MS,
      contact: { email: 'mgroad@unitedbank.example', phone: '8040011223', address: '52 MG Road, Bengaluru' },
      dailyCustomers: '200 to 500',
      labels: { resource: 'Counter', resourcePlural: 'Counters', service: 'Service' },
      branding: {
        logoDataUrl: svgLogo('#7C3AED', '<path d="M32 12l20 10H12zM16 26h6v18h-6zM29 26h6v18h-6zM42 26h6v18h-6zM12 47h40v5H12z" fill="#fff"/>'),
        brandColor: '#7C3AED',
        welcomeMessage: 'Pick a service and take a seat. Your token appears on the screen when it is your turn.',
        hidePoweredBy: true,
      },
      slugHistory: [],
      settings: {
        queueMode: 'per_service', tokenPrefix: 'C', allowPriority: true, allowAnyAvailable: false, maxTokensPerDay: 400, noShowMinutes: 5,
        customerFields: [NAME, PHONE, { key: 'account', label: 'Last 4 digits of account', type: 'text', required: false }],
      },
      services: [
        { id: 'svc_ub_cash', name: 'Cash deposit and withdrawal', avgMinutes: 6, prefix: 'C', isActive: true },
        { id: 'svc_ub_acc', name: 'Accounts and KYC', avgMinutes: 12, prefix: 'K', isActive: true },
        { id: 'svc_ub_loan', name: 'Loans', avgMinutes: 20, prefix: 'L', isActive: true },
      ],
      resources: [
        { id: 'res_ub_1', name: 'Counter 1', serviceIds: ['svc_ub_cash'], isActive: true, isPaused: false },
        { id: 'res_ub_2', name: 'Counter 2', serviceIds: ['svc_ub_cash', 'svc_ub_acc'], isActive: true, isPaused: false },
        { id: 'res_ub_3', name: 'Counter 3', serviceIds: ['svc_ub_loan', 'svc_ub_acc'], isActive: true, isPaused: false },
      ],
      hours: allDay,
      notifications: { almostSms: true, almostBrowser: true, dailySummary: true, staffJoins: false },
      setup: baseSetup,
      smsUsed: 212,
    },
    {
      id: 'biz_canteen',
      name: 'Campus Canteen',
      slug: 'campus-canteen',
      type: 'canteen',
      plan: 'pro',
      billingCycle: 'monthly',
      isLive: true,
      isOpen: true,
      createdAt: now - 200 * DAY_MS,
      contact: { email: 'canteen@campus.example', phone: '9000012345', address: 'Block C, North Campus, Pune' },
      dailyCustomers: '200 to 500',
      labels: { resource: 'Counter', resourcePlural: 'Counters', service: 'Service' },
      branding: {
        logoDataUrl: svgLogo('#EA580C', '<circle cx="32" cy="34" r="14" fill="none" stroke="#fff" stroke-width="5"/><path d="M20 14v12M26 14v12M23 14v36M44 14c-5 4-5 14 0 18v18" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round"/>'),
        brandColor: '#EA580C',
        welcomeMessage: 'Order at the counter, take a token, and grab a seat. We will buzz you when your food is ready.',
        hidePoweredBy: false,
      },
      // Old link kept so /college-canteen redirects here.
      slugHistory: [{ slug: 'college-canteen', redirectUntil: now + 62 * DAY_MS }],
      settings: {
        queueMode: 'shared', tokenPrefix: 'T', allowPriority: false, allowAnyAvailable: false, maxTokensPerDay: 500, noShowMinutes: 5,
        customerFields: [NAME, PHONE],
      },
      services: [{ id: 'svc_cn_meal', name: 'Meal pickup', avgMinutes: 4, prefix: 'T', isActive: true }],
      resources: [{ id: 'res_cn_1', name: 'Pickup counter', serviceIds: ['svc_cn_meal'], isActive: true, isPaused: false }],
      hours: allDay,
      notifications: { almostSms: false, almostBrowser: true, dailySummary: false, staffJoins: true },
      setup: baseSetup,
      smsUsed: 41,
    },
    {
      id: 'biz_glow',
      name: 'Glow Studio Salon',
      slug: 'glow-studio',
      type: 'salon',
      plan: 'free',
      billingCycle: 'monthly',
      isLive: false,
      isOpen: true,
      createdAt: now - 3 * DAY_MS,
      contact: { email: 'hello@glowstudio.example', phone: '9988776655', address: '7 Linking Road, Mumbai' },
      dailyCustomers: 'Under 50',
      labels: { resource: 'Stylist', resourcePlural: 'Stylists', service: 'Service' },
      branding: { logoDataUrl: '', brandColor: '#DB2777', welcomeMessage: 'Relax, we will save your spot.', hidePoweredBy: false },
      slugHistory: [],
      settings: {
        queueMode: 'per_resource', tokenPrefix: 'S', allowPriority: false, allowAnyAvailable: true, maxTokensPerDay: 80, noShowMinutes: 5,
        customerFields: [NAME, PHONE],
      },
      services: [
        { id: 'svc_gl_cut', name: 'Haircut', avgMinutes: 30, prefix: 'H', isActive: true },
        { id: 'svc_gl_col', name: 'Colour', avgMinutes: 60, prefix: 'C', isActive: true },
      ],
      resources: [
        { id: 'res_gl_1', name: 'Neha', serviceIds: ['svc_gl_cut', 'svc_gl_col'], isActive: true, isPaused: false },
        { id: 'res_gl_2', name: 'Arif', serviceIds: ['svc_gl_cut'], isActive: true, isPaused: false },
      ],
      hours: DEFAULT_HOURS,
      notifications: { almostSms: false, almostBrowser: true, dailySummary: true, staffJoins: true },
      setup: { joinFormCustomised: false, brandingSet: false, hoursSet: false, qrPrinted: false, testTokenRun: false, slugConfirmed: false },
      smsUsed: 0,
    },
  ];
}
