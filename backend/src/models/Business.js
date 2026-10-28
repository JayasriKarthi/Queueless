import mongoose from 'mongoose';
import { schemaOptions, ObjectId } from './shared.js';
import { BUSINESS_TYPES, DAILY_CUSTOMER_RANGES, QUEUE_MODES, FIELD_TYPES, DAYS, PLAN_IDS, NO_SHOW_MINUTES } from '../utils/constants.js';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/; // HH:MM, 24-hour

// One field on the customer join form, for example { key: 'age', label: 'Age', type: 'number' }.
const customerFieldSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true, maxlength: 60 },
    type: { type: String, enum: FIELD_TYPES, default: 'text' },
    required: { type: Boolean, default: false },
    locked: { type: Boolean, default: false }, // name and phone can never be removed
    options: { type: [String], default: undefined }, // only for type "select"
  },
  { _id: false },
);

const daySchema = new mongoose.Schema(
  {
    open: { type: Boolean, default: true },
    from: { type: String, match: TIME, default: '09:00' },
    to: { type: String, match: TIME, default: '18:00' },
  },
  { _id: false },
);

const defaultHours = () =>
  Object.fromEntries(DAYS.map((day) => [day, { open: day !== 'sun', from: day === 'sat' ? '10:00' : '09:00', to: day === 'sat' ? '14:00' : '18:00' }]));

const businessSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true }, // public link: /:slug
    type: { type: String, enum: BUSINESS_TYPES, required: true },
    plan: { type: String, enum: PLAN_IDS, default: 'free' },
    billingCycle: { type: String, enum: ['monthly', 'yearly'], default: 'monthly' },
    intendedPlan: { type: String, enum: [...PLAN_IDS, null], default: null }, // ?plan= chosen at signup
    isLive: { type: Boolean, default: false },
    isOpen: { type: Boolean, default: true }, // false = "Pause queue (close for now)"
    ownerId: { type: ObjectId, ref: 'User' },
    // Decides when "today" starts and ends for token numbers, daily limits, and analytics.
    timeZone: {
      type: String,
      default: 'Asia/Kolkata',
      validate: {
        validator: (tz) => {
          try {
            new Intl.DateTimeFormat('en-US', { timeZone: tz });
            return true;
          } catch {
            return false;
          }
        },
        message: 'Unknown time zone',
      },
    },

    contact: {
      email: { type: String, trim: true, lowercase: true, default: '' },
      phone: { type: String, trim: true, default: '' },
      address: { type: String, trim: true, default: '' },
    },
    dailyCustomers: { type: String, enum: [...DAILY_CUSTOMER_RANGES, null], default: null },

    // What this business calls things: "Doctor", "Counter", "Stylist".
    labels: {
      resource: { type: String, trim: true, default: 'Counter' },
      resourcePlural: { type: String, trim: true, default: 'Counters' },
      service: { type: String, trim: true, default: 'Service' },
    },

    branding: {
      logoUrl: { type: String, default: '' },
      brandColor: { type: String, match: /^#[0-9a-fA-F]{6}$/, default: '#0E9F8E' },
      welcomeMessage: { type: String, trim: true, maxlength: 120, default: '' },
      hidePoweredBy: { type: Boolean, default: false }, // only honoured on plans with removeBranding
    },

    settings: {
      queueMode: { type: String, enum: Object.values(QUEUE_MODES), default: QUEUE_MODES.SHARED },
      tokenPrefix: { type: String, match: /^[A-Z]{1,2}$/, default: 'A' },
      allowPriority: { type: Boolean, default: false },
      allowAnyAvailable: { type: Boolean, default: false },
      maxTokensPerDay: { type: Number, min: 1, default: 200 },
      noShowMinutes: { type: Number, min: 1, max: 30, default: NO_SHOW_MINUTES },
      // Mark called customers who never arrive as no-shows automatically (off: staff do it by hand).
      autoNoShow: { type: Boolean, default: false },
      customerFields: { type: [customerFieldSchema], default: undefined },
    },

    hours: {
      type: new mongoose.Schema(Object.fromEntries(DAYS.map((day) => [day, { type: daySchema }])), { _id: false }),
      default: defaultHours,
    },

    notifications: {
      almostSms: { type: Boolean, default: false },
      almostBrowser: { type: Boolean, default: true },
      dailySummary: { type: Boolean, default: true },
      staffJoins: { type: Boolean, default: true },
    },

    // Setup guide and go-live checklist progress.
    setup: {
      joinFormCustomised: { type: Boolean, default: false },
      brandingSet: { type: Boolean, default: false },
      hoursSet: { type: Boolean, default: false },
      qrPrinted: { type: Boolean, default: false },
      testTokenRun: { type: Boolean, default: false },
      slugConfirmed: { type: Boolean, default: false },
    },

    smsUsed: { type: Number, min: 0, default: 0 }, // SMS sent this calendar month
    smsMonth: { type: String }, // YYYY-MM the smsUsed count belongs to (reset by the cleanup job)
  },
  schemaOptions,
);

export const Business = mongoose.model('Business', businessSchema);
export default Business;
