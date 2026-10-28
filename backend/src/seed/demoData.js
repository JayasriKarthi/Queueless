import { DAY_MS } from '../utils/constants.js';
import { dateKey } from '../utils/tokenNumber.js';

// The frontend's demo world (frontend/src/data/), as plain data for seed.js. Records refer to
// each other by `key` ('citycare', 'cc_gen'...); seed.js turns keys into ObjectIds and hashes
// every secret. Times are relative to `now`, so the demo always looks current.

export const DEMO_PASSWORD = 'demo1234';
const ZONE = 'Asia/Kolkata';
const MIN = 60 * 1000;
const HOUR = 60 * MIN;

/* ------------------------------------------------------------ helpers */

// Seeded random numbers: the same demo every time it is seeded.
function createRandom(seed) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (list) => list[Math.floor(next() * list.length)],
    chance: (p) => next() < p,
  };
}

const FIRST_NAMES = ['Aarav', 'Aditi', 'Akash', 'Ananya', 'Arjun', 'Bhavna', 'Deepak', 'Divya', 'Gaurav', 'Ishaan', 'Kavya', 'Kiran', 'Lakshmi', 'Manoj', 'Meena', 'Nikhil', 'Pooja', 'Rahul', 'Riya', 'Sanjay', 'Shreya', 'Sunil', 'Tanvi', 'Varun', 'Zoya', 'Farhan', 'Harpreet', 'Joseph', 'Mary', 'Ayesha'];
const LAST_NAMES = ['Sharma', 'Iyer', 'Nair', 'Reddy', 'Patel', 'Gupta', 'Menon', 'Rao', 'Singh', 'Das', 'Kulkarni', 'Pillai', 'Khan', 'Fernandes', 'Joshi', 'Banerjee', 'Chopra', 'Shetty', 'Verma', 'Mishra'];
const REASONS = ['Fever or cold', 'Follow-up', 'Check-up', 'Other'];

// A time on a local (India) date: atLocal('2026-10-28', 9 * 60) is 09:00 that day.
const atLocal = (day, minutesAfterMidnight) => new Date(new Date(`${day}T00:00:00+05:30`).getTime() + minutesAfterMidnight * MIN);

const ago = (now, ms) => new Date(now.getTime() - ms);
const later = (now, ms) => new Date(now.getTime() + ms);

/* --------------------------------------------------------- businesses */

const NAME = { key: 'name', label: 'Full name', type: 'text', required: true, locked: true };
const PHONE = { key: 'phone', label: 'Mobile number', type: 'text', required: true, locked: true };
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const allWeek = Object.fromEntries(DAYS.map((d) => [d, { open: true, from: '08:00', to: '21:00' }]));
const fullSetup = { joinFormCustomised: true, brandingSet: true, hoursSet: true, qrPrinted: true, testTokenRun: true, slugConfirmed: true };

function businesses(now) {
  return [
    {
      key: 'citycare',
      name: 'City Care Clinic',
      slug: 'city-care',
      type: 'clinic',
      plan: 'free', // over the Free limits on purpose: shows the upgrade prompts
      billingCycle: 'monthly',
      isLive: true,
      isOpen: true,
      createdAt: ago(now, 120 * DAY_MS),
      contact: { email: 'frontdesk@citycare.example', phone: '9845012345', address: '14 Residency Road, Bengaluru' },
      dailyCustomers: '50 to 200',
      labels: { resource: 'Doctor', resourcePlural: 'Doctors', service: 'Service' },
      branding: { brandColor: '#2563EB', welcomeMessage: 'Welcome to City Care. Join the line and relax, we will alert you before your turn.', hidePoweredBy: false },
      settings: {
        queueMode: 'per_resource', tokenPrefix: 'A', allowPriority: true, allowAnyAvailable: false, maxTokensPerDay: 200, noShowMinutes: 5,
        customerFields: [NAME, PHONE, { key: 'age', label: 'Age', type: 'number', required: true }, { key: 'reason', label: 'Reason for visit', type: 'select', required: false, options: REASONS }],
      },
      services: [
        { key: 'cc_gen', name: 'General consultation', avgMinutes: 12, prefix: 'A' },
        { key: 'cc_child', name: 'Child health', avgMinutes: 15, prefix: 'B' },
        { key: 'cc_skin', name: 'Skin care', avgMinutes: 10, prefix: 'D' },
      ],
      resources: [
        { key: 'cc_1', name: 'Dr. Ananya Rao', services: ['cc_gen'] },
        { key: 'cc_2', name: 'Dr. Vikram Menon', services: ['cc_child'] },
        { key: 'cc_3', name: 'Dr. Farah Siddiqui', services: ['cc_skin'] },
      ],
      hours: allWeek,
      notifications: { almostSms: false, almostBrowser: true, dailySummary: true, staffJoins: true },
      setup: { ...fullSetup, joinFormCustomised: false, brandingSet: false, hoursSet: false, qrPrinted: false, testTokenRun: false },
      smsUsed: 0,
    },
    {
      key: 'unitedbank',
      name: 'United Bank, MG Road',
      slug: 'united-bank',
      type: 'bank',
      plan: 'business',
      billingCycle: 'yearly',
      isLive: true,
      isOpen: true,
      createdAt: ago(now, 300 * DAY_MS),
      contact: { email: 'mgroad@unitedbank.example', phone: '8040011223', address: '52 MG Road, Bengaluru' },
      dailyCustomers: '200 to 500',
      labels: { resource: 'Counter', resourcePlural: 'Counters', service: 'Service' },
      branding: { brandColor: '#7C3AED', welcomeMessage: 'Pick a service and take a seat. Your token appears on the screen when it is your turn.', hidePoweredBy: true },
      settings: {
        queueMode: 'per_service', tokenPrefix: 'C', allowPriority: true, allowAnyAvailable: false, maxTokensPerDay: 400, noShowMinutes: 5,
        customerFields: [NAME, PHONE, { key: 'account', label: 'Last 4 digits of account', type: 'text', required: false }],
      },
      services: [
        { key: 'ub_cash', name: 'Cash deposit and withdrawal', avgMinutes: 6, prefix: 'C' },
        { key: 'ub_acc', name: 'Accounts and KYC', avgMinutes: 12, prefix: 'K' },
        { key: 'ub_loan', name: 'Loans', avgMinutes: 20, prefix: 'L' },
      ],
      resources: [
        { key: 'ub_1', name: 'Counter 1', services: ['ub_cash'] },
        { key: 'ub_2', name: 'Counter 2', services: ['ub_cash', 'ub_acc'] },
        { key: 'ub_3', name: 'Counter 3', services: ['ub_loan', 'ub_acc'] },
      ],
      hours: allWeek,
      notifications: { almostSms: true, almostBrowser: true, dailySummary: true, staffJoins: false },
      setup: fullSetup,
      smsUsed: 212,
    },
    {
      key: 'canteen',
      name: 'Campus Canteen',
      slug: 'campus-canteen',
      type: 'canteen',
      plan: 'pro',
      billingCycle: 'monthly',
      isLive: true,
      isOpen: true,
      createdAt: ago(now, 200 * DAY_MS),
      contact: { email: 'canteen@campus.example', phone: '9000012345', address: 'Block C, North Campus, Pune' },
      dailyCustomers: '200 to 500',
      labels: { resource: 'Counter', resourcePlural: 'Counters', service: 'Service' },
      branding: { brandColor: '#EA580C', welcomeMessage: 'Order at the counter, take a token, and grab a seat. We will buzz you when your food is ready.', hidePoweredBy: false },
      settings: { queueMode: 'shared', tokenPrefix: 'T', allowPriority: false, allowAnyAvailable: false, maxTokensPerDay: 500, noShowMinutes: 5, customerFields: [NAME, PHONE] },
      services: [{ key: 'cn_meal', name: 'Meal pickup', avgMinutes: 4, prefix: 'T' }],
      resources: [{ key: 'cn_1', name: 'Pickup counter', services: ['cn_meal'] }],
      // The old link still works: /college-canteen redirects here for 62 more days.
      oldSlugs: [{ slug: 'college-canteen', redirectUntil: later(now, 62 * DAY_MS) }],
      hours: allWeek,
      notifications: { almostSms: false, almostBrowser: true, dailySummary: false, staffJoins: true },
      setup: fullSetup,
      smsUsed: 41,
    },
    {
      key: 'glow',
      name: 'Glow Studio Salon',
      slug: 'glow-studio',
      type: 'salon',
      plan: 'free',
      billingCycle: 'monthly',
      isLive: false, // still setting up: shows the go-live checklist
      isOpen: true,
      createdAt: ago(now, 3 * DAY_MS),
      contact: { email: 'hello@glowstudio.example', phone: '9988776655', address: '7 Linking Road, Mumbai' },
      dailyCustomers: 'Under 50',
      labels: { resource: 'Stylist', resourcePlural: 'Stylists', service: 'Service' },
      branding: { brandColor: '#DB2777', welcomeMessage: 'Relax, we will save your spot.', hidePoweredBy: false },
      settings: { queueMode: 'per_resource', tokenPrefix: 'S', allowPriority: false, allowAnyAvailable: true, maxTokensPerDay: 80, noShowMinutes: 5, customerFields: [NAME, PHONE] },
      services: [
        { key: 'gl_cut', name: 'Haircut', avgMinutes: 30, prefix: 'H' },
        { key: 'gl_col', name: 'Colour', avgMinutes: 60, prefix: 'C' },
      ],
      resources: [
        { key: 'gl_1', name: 'Neha', services: ['gl_cut', 'gl_col'] },
        { key: 'gl_2', name: 'Arif', services: ['gl_cut'] },
      ],
      // hours left out: the model's default (Mon–Sat), like a brand-new business
      notifications: { almostSms: false, almostBrowser: true, dailySummary: true, staffJoins: true },
      setup: { joinFormCustomised: false, brandingSet: false, hoursSet: false, qrPrinted: false, testTokenRun: false, slugConfirmed: false },
      smsUsed: 0,
    },
  ];
}

/* -------------------------------------------------------------- users */

const AVATAR_COLORS = ['#0E9F8E', '#2563EB', '#7C3AED', '#DB2777', '#EA580C', '#CA8A04'];

function users(now) {
  const owner = (key, name, email, business) => ({
    key, name, email, role: 'owner', business, resource: null, pin: '1111',
    lastLoginAt: ago(now, 2 * HOUR), createdAt: ago(now, 120 * DAY_MS), avatarColor: '#0B1F1C',
  });
  const staff = (key, name, email, business, resource, pin, lastLoginHoursAgo, i, role = 'staff') => ({
    key, name, email, role, business, resource, pin,
    lastLoginAt: ago(now, lastLoginHoursAgo * HOUR), createdAt: ago(now, 60 * DAY_MS), avatarColor: AVATAR_COLORS[i % AVATAR_COLORS.length],
  });
  return [
    // The main demo accounts
    owner('owner_cc', 'Meera Krishnan', 'owner@demo.com', 'citycare'),
    staff('staff_cc1', 'Rohan Iyer', 'staff@demo.com', 'citycare', 'cc_1', '1234', 1, 0),
    staff('staff_cc2', 'Lakshmi Nair', 'lakshmi@citycare.example', 'citycare', 'cc_2', '2345', 5, 1),
    staff('staff_cc3', 'Imran Khan', 'imran@citycare.example', 'citycare', 'cc_3', '3456', 26, 2, 'manager'),

    // A second business, to show tenant isolation
    owner('owner_ub', 'Suresh Reddy', 'owner.bank@demo.com', 'unitedbank'),
    staff('staff_ub1', 'Priya Sharma', 'staff.bank@demo.com', 'unitedbank', 'ub_1', '1234', 2, 3),
    staff('staff_ub2', 'Karthik Subramanian', 'karthik@unitedbank.example', 'unitedbank', 'ub_2', '4567', 3, 4),
    staff('staff_ub3', 'Fatima Ahmed', 'fatima@unitedbank.example', 'unitedbank', 'ub_3', '5678', 30, 5, 'manager'),

    owner('owner_cn', 'Gurpreet Kaur', 'owner.canteen@demo.com', 'canteen'),
    staff('staff_cn1', 'Arun Pillai', 'staff.canteen@demo.com', 'canteen', 'cn_1', '1234', 1, 0),
    staff('staff_cn2', 'Divya Joshi', 'divya@campus.example', 'canteen', 'cn_1', '6789', 8, 1),
    staff('staff_cn3', 'Joseph Fernandes', 'joseph@campus.example', 'canteen', 'cn_1', '7890', 48, 2),

    owner('owner_gl', 'Neha Desai', 'owner.salon@demo.com', 'glow'),
  ];
}

/* ------------------------------------------------------------ invites */

// Invite links are 32 characters; the demo ones are readable so they can be typed in.
const inviteToken = (name) => `demo-invite-${name}`.padEnd(32, '0');

// One of each state: pending, expiring soon, expired, revoked, accepted.
function invites(now) {
  const make = (name, business, email, role, resource, createdDaysAgo, extra = {}) => ({
    token: inviteToken(name), business, email, role, resource, status: 'pending', invitedBy: business === 'citycare' ? 'owner_cc' : 'owner_ub',
    createdAt: ago(now, createdDaysAgo * DAY_MS), expiresAt: later(ago(now, createdDaysAgo * DAY_MS), 7 * DAY_MS), ...extra,
  });
  return [
    make('pending', 'citycare', 'kavya.reddy@citycare.example', 'staff', 'cc_1', 1),
    make('soon', 'citycare', 'arjun.das@citycare.example', 'manager', 'cc_2', 6.6), // expires in about 10 hours
    make('expired', 'citycare', 'sneha.patel@citycare.example', 'staff', 'cc_3', 12),
    make('revoked', 'citycare', 'rahul.verma@citycare.example', 'staff', 'cc_1', 4, { status: 'revoked', revokedAt: ago(now, 3 * DAY_MS) }),
    make('accepted', 'citycare', 'lakshmi@citycare.example', 'staff', 'cc_2', 60.5, { status: 'accepted', acceptedAt: ago(now, 60 * DAY_MS), user: 'staff_cc2' }),
    make('bank', 'unitedbank', 'new.teller@unitedbank.example', 'staff', 'ub_1', 2),
  ];
}

/* ------------------------------------------------------------ billing */

function subscriptions(now) {
  return [
    { business: 'unitedbank', plan: 'business', cycle: 'yearly', status: 'active', currentPeriodEnd: later(now, 325 * DAY_MS) },
    { business: 'canteen', plan: 'pro', cycle: 'monthly', status: 'active', currentPeriodEnd: later(now, 18 * DAY_MS) },
  ];
}

// Amounts in paise, like real invoices (₹999 = 99900).
function invoices(now) {
  const inv = (number, business, daysAgo, plan, rupees, status = 'paid') => ({ number, business, date: ago(now, daysAgo * DAY_MS), plan, amount: rupees * 100, status });
  return [
    inv('QL-UB-2401', 'unitedbank', 40, 'Business (yearly)', 28790),
    inv('QL-UB-2312', 'unitedbank', 405, 'Business (yearly)', 28790),
    inv('QL-CN-2410', 'canteen', 12, 'Pro (monthly)', 999),
    inv('QL-CN-2409', 'canteen', 42, 'Pro (monthly)', 999),
    inv('QL-CN-2408', 'canteen', 72, 'Pro (monthly)', 999),
    inv('QL-CN-2407', 'canteen', 103, 'Pro (monthly)', 999, 'refunded'),
  ];
}

/* ------------------------------------------------- activity and bell */

function activity(now) {
  const a = (business, minsAgo, kind, text) => ({ business, createdAt: ago(now, minsAgo * MIN), kind, text });
  return [
    a('citycare', 4, 'call', 'Dr. Ananya Rao called the next token'),
    a('citycare', 18, 'join', '6 customers joined from the QR code in the last hour'),
    a('citycare', 55, 'staff', 'Lakshmi Nair logged in to the staff console'),
    a('citycare', 190, 'settings', 'Queue rules updated: priority for seniors turned on'),
    a('citycare', 1440, 'invite', 'Invite sent to kavya.reddy@citycare.example'),
    a('citycare', 2880, 'rating', 'A customer rated their visit 5 stars'),
    a('unitedbank', 6, 'call', 'Counter 2 called the next token'),
    a('unitedbank', 40, 'join', '14 customers joined in the last hour'),
    a('unitedbank', 600, 'billing', 'Business plan renewed'),
    a('canteen', 3, 'call', 'Pickup counter called the next token'),
    a('canteen', 300, 'settings', 'Link changed from college-canteen to campus-canteen'),
    a('glow', 120, 'settings', 'Business set up from the salon template'),
  ];
}

function notifications(now) {
  const n = (business, minsAgo, kind, title, body, read = false) => ({ business, createdAt: ago(now, minsAgo * MIN), kind, title, body, read });
  return [
    n('citycare', 12, 'long_line', 'Line is getting long', 'Dr. Ananya Rao has 4 or more people waiting.'),
    n('citycare', 300, 'invite_expiring', 'Invite expiring soon', 'The invite for arjun.das@citycare.example expires in 10 hours. Resend it if they still need it.'),
    n('citycare', 2000, 'daily_summary', 'Yesterday at a glance', '58 tokens, 51 served, 4 no-shows, average wait 14 min.', true),
    n('unitedbank', 30, 'sms_low', 'SMS credits at 42%', 'You have used 212 of 500 SMS this month.'),
  ];
}

/* ------------------------------------------------------------- tokens */

// 67 to 100 tokens per live business: 2 or 3 a day for the last 29 days, then today's line
// with some served, one being served or called per counter, and a few still waiting.
function tokensFor(business, index, now) {
  const rnd = createRandom(1000 + index * 77);
  const phones = new Set();
  const phone = () => {
    let p;
    do p = `${rnd.pick(['6', '7', '8', '9'])}${String(rnd.int(0, 999999999)).padStart(9, '0')}`; while (phones.has(p));
    phones.add(p);
    return p;
  };
  const customer = () => {
    const c = { name: `${rnd.pick(FIRST_NAMES)} ${rnd.pick(LAST_NAMES)}`, phone: phone() };
    for (const f of business.settings.customerFields) {
      if (f.key === 'age') c.age = rnd.int(4, 78);
      if (f.key === 'reason') c.reason = rnd.pick(REASONS);
      if (f.key === 'account') c.account = String(rnd.int(1000, 9999));
    }
    return c;
  };

  const planned = []; // { createdAt, status, resource, wait, calledAt? }
  for (let d = 29; d >= 1; d -= 1) {
    const day = dateKey(ago(now, d * DAY_MS), ZONE);
    const times = Array.from({ length: rnd.int(2, 3) }, () => atLocal(day, 9 * 60 + rnd.int(0, 9 * 60))).sort((a, b) => a - b);
    for (const createdAt of times) {
      const status = rnd.chance(0.82) ? 'DONE' : rnd.chance(0.6) ? 'NO_SHOW' : 'CANCELLED';
      planned.push({ createdAt, status, resource: rnd.pick(business.resources), wait: rnd.int(3, 28) });
    }
  }
  // Today, oldest first, all finished before now: served earlier, then the people at the
  // counters right now, then the waiting line.
  const served = rnd.int(4, 5);
  for (let i = served - 1; i >= 0; i -= 1) {
    planned.push({ createdAt: ago(now, (40 + i * 12) * MIN), status: rnd.chance(0.9) ? 'DONE' : 'NO_SHOW', resource: rnd.pick(business.resources), wait: rnd.int(3, 10) });
  }
  business.resources.forEach((resource, ri) => {
    planned.push({ createdAt: ago(now, (30 - ri * 2) * MIN), status: ri === 0 ? 'SERVING' : 'CALLED', resource, calledAt: ago(now, rnd.int(2, 4) * MIN) });
  });
  const waiting = rnd.int(4, 5);
  for (let i = 0; i < waiting; i += 1) {
    planned.push({ createdAt: ago(now, (15 - i * 3) * MIN), status: 'WAITING', resource: business.resources[i % business.resources.length] });
  }

  const numbers = {}; // "2026-10-28:A" → last number
  return planned.map(({ createdAt, status, resource, wait, calledAt: fixedCall }) => {
    const pool = business.services.filter((s) => resource.services.includes(s.key));
    const service = rnd.pick(pool.length ? pool : business.services);
    const prefix = business.settings.queueMode === 'shared' ? business.settings.tokenPrefix : service.prefix;
    const day = dateKey(createdAt, ZONE);
    const number = (numbers[`${day}:${prefix}`] = (numbers[`${day}:${prefix}`] ?? 0) + 1);
    const serveMinutes = Math.max(2, service.avgMinutes + rnd.int(-3, 6));
    const calledAt = status === 'WAITING' || status === 'CANCELLED' ? null : fixedCall ?? new Date(createdAt.getTime() + wait * MIN);
    const perResource = business.settings.queueMode === 'per_resource';
    return {
      business: business.key,
      day,
      number,
      code: `${prefix}-${String(number).padStart(3, '0')}`,
      prefix,
      service: service.key,
      // Waiting tokens only belong to a counter when the line is per counter (per doctor).
      resource: status === 'WAITING' || status === 'CANCELLED' ? (perResource ? resource.key : null) : resource.key,
      queue: perResource ? { type: 'res', key: resource.key } : business.settings.queueMode === 'per_service' ? { type: 'svc', key: service.key } : { type: 'shared' },
      customer: customer(),
      priority: business.settings.allowPriority && rnd.chance(0.08),
      status,
      source: rnd.chance(0.8) ? 'qr' : 'walk-in',
      createdAt,
      calledAt,
      servedAt: ['SERVING', 'DONE'].includes(status) ? new Date(calledAt.getTime() + MIN) : null,
      doneAt: status === 'DONE' ? new Date(calledAt.getTime() + MIN + serveMinutes * MIN) : status === 'NO_SHOW' ? new Date(calledAt.getTime() + 5 * MIN) : null,
      cancelledAt: status === 'CANCELLED' ? new Date(createdAt.getTime() + rnd.int(2, 14) * MIN) : null,
      cancelledBy: status === 'CANCELLED' ? 'customer' : null,
      rating: status === 'DONE' && rnd.chance(0.5) ? rnd.pick([3, 4, 4, 5, 5, 5]) : null,
    };
  });
}

/* --------------------------------------------------------------- all */

export function buildDemoData(now = new Date()) {
  const list = businesses(now);
  return {
    businesses: list,
    users: users(now),
    invites: invites(now),
    subscriptions: subscriptions(now),
    invoices: invoices(now),
    activity: activity(now),
    notifications: notifications(now),
    tokens: list.filter((b) => b.isLive).flatMap((b, i) => tokensFor(b, i, now)),
  };
}
