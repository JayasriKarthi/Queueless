import { z } from 'zod';
import { BUSINESS_TYPES, DAILY_CUSTOMER_RANGES, QUEUE_MODES, FIELD_TYPES, DAYS, LOCKED_FIELD_KEYS } from '../utils/constants.js';

// strictObject rejects unknown keys, so fields like plan, slug, or isLive can never be
// changed through these routes (they have their own endpoints and rules).

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const text = (max, message) => z.string().trim().min(1, { error: message }).max(max, { error: `Keep it under ${max} characters` });

/* ------------------------------------------------------- onboarding */

export const welcomeSchema = z.strictObject({
  type: z.enum(BUSINESS_TYPES, { error: 'Pick a business type' }).optional(),
  dailyCustomers: z.enum(DAILY_CUSTOMER_RANGES, { error: 'Pick a range' }).nullable().optional(),
});

/* --------------------------------------------------------- settings */

// One join-form field. Keys become property names on each token's customer data.
const customerFieldSchema = z
  .strictObject({
    key: z.string().regex(/^[a-z][a-z0-9_]{0,29}$/, { error: 'Use lowercase letters, numbers, and underscores' }),
    label: text(60, 'Every field needs a label'),
    type: z.enum(FIELD_TYPES, { error: 'Unknown field type' }),
    required: z.boolean().default(false),
    locked: z.boolean().optional(),
    options: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
  })
  .refine((f) => f.type !== 'select' || (f.options?.length ?? 0) > 0, { error: 'Dropdown fields need at least one option', path: ['options'] });

const customerFieldsSchema = z
  .array(customerFieldSchema)
  .min(2)
  .max(15, { error: 'Use at most 15 fields' })
  .superRefine((fields, ctx) => {
    const keys = fields.map((f) => f.key);
    keys.forEach((key, i) => {
      if (keys.indexOf(key) !== i) ctx.addIssue({ code: 'custom', message: `The field key "${key}" is used twice`, path: [i, 'key'] });
    });
    LOCKED_FIELD_KEYS.forEach((key) => {
      const field = fields.find((f) => f.key === key);
      if (!field) ctx.addIssue({ code: 'custom', message: `The "${key}" field cannot be removed`, path: [] });
      else if (!field.required) ctx.addIssue({ code: 'custom', message: `The "${key}" field must stay required`, path: [keys.indexOf(key), 'required'] });
    });
  });

const daySchema = z
  .strictObject(
    {
      open: z.boolean(),
      from: z.string().regex(TIME, { error: 'Use HH:MM' }),
      to: z.string().regex(TIME, { error: 'Use HH:MM' }),
    },
    { error: (issue) => (issue.input === undefined ? 'Send all seven days, including closed ones' : undefined) },
  )
  .refine((d) => !d.open || d.from < d.to, { error: 'Opening time must be before closing time', path: ['to'] });

// All seven days, every time, so the stored hours are always complete.
const hoursSchema = z.strictObject(Object.fromEntries(DAYS.map((day) => [day, daySchema])));

export const settingsSchema = z
  .strictObject({
    name: text(80, 'Enter a business name').optional(),
    type: z.enum(BUSINESS_TYPES, { error: 'Pick a business type' }).optional(),
    contact: z
      .strictObject({
        email: z.union([z.literal(''), z.string().trim().toLowerCase().pipe(z.email({ error: 'Enter a valid email' }))]).optional(),
        phone: z.string().trim().max(20).optional(),
        address: z.string().trim().max(200).optional(),
      })
      .optional(),
    labels: z
      .strictObject({
        resource: text(30, 'Enter a name, for example Doctor').optional(),
        resourcePlural: text(30, 'Enter a plural, for example Doctors').optional(),
        service: text(30, 'Enter a name, for example Service').optional(),
      })
      .optional(),
    settings: z
      .strictObject({
        queueMode: z.enum(Object.values(QUEUE_MODES), { error: 'Pick shared, per service, or per resource' }).optional(),
        tokenPrefix: z.string().regex(/^[A-Z]{1,2}$/, { error: 'Use 1 or 2 capital letters' }).optional(),
        allowPriority: z.boolean().optional(),
        allowAnyAvailable: z.boolean().optional(),
        maxTokensPerDay: z.number().int().min(1, { error: 'At least 1 token a day' }).max(100000).optional(),
        noShowMinutes: z.number().int().min(1, { error: 'At least 1 minute' }).max(30, { error: 'At most 30 minutes' }).optional(),
        autoNoShow: z.boolean().optional(),
        customerFields: customerFieldsSchema.optional(),
      })
      .optional(),
    hours: hoursSchema.optional(),
    notifications: z
      .strictObject({
        almostSms: z.boolean().optional(),
        almostBrowser: z.boolean().optional(),
        dailySummary: z.boolean().optional(),
        staffJoins: z.boolean().optional(),
      })
      .optional(),
    // Sent after the owner confirms the "change queue mode while people are waiting" dialog.
    confirm: z.boolean().optional(),
  })
  .refine((body) => Object.keys(body).some((key) => key !== 'confirm'), { error: 'Nothing to update' });

/* ---------------------------------------------------------- go live */

export const openSchema = z.strictObject({ isOpen: z.boolean({ error: 'Send isOpen: true or false' }) });

// Pixel width of the QR image (query strings are text, so it is converted to a number).
export const qrQuery = z.strictObject({
  size: z.coerce.number({ error: 'Size must be a number' }).int().min(128, { error: 'At least 128 pixels' }).max(2048, { error: 'At most 2048 pixels' }).default(512),
});

/* ------------------------------------------------------------- slug */

const slugInput = z.string().trim().toLowerCase().max(60);

export const slugCheckQuery = z.strictObject({ slug: slugInput });

// DELETE /api/business: the owner types the business's link to confirm.
export const deleteBusinessSchema = z.strictObject({
  slug: z.string({ error: 'Type your business link to confirm' }).max(60),
});

export const changeSlugSchema = z.strictObject({
  slug: slugInput,
  // The "I understand printed QR codes will stop working" checkbox, required once live.
  confirmBreakingQr: z.boolean().optional(),
});

/* --------------------------------------------- services and resources */

export const objectId = z.string().regex(/^[a-f0-9]{24}$/, { error: 'Not a valid id' });
const idList = (min, message) => z.array(objectId).min(min, { error: message }).max(200).transform((ids) => [...new Set(ids)]);
const nonEmpty = (body) => Object.keys(body).length > 0;

export const idParams = z.strictObject({ id: objectId });

export const listQuery = z.strictObject({
  status: z.enum(['all', 'active', 'inactive'], { error: 'Use all, active, or inactive' }).default('all'),
  q: z.string().trim().max(80).optional(),
});

const serviceFields = {
  name: text(80, 'Enter a name'),
  avgMinutes: z.number({ error: 'Enter minutes' }).int().min(1, { error: 'At least 1 minute' }).max(240, { error: 'At most 240 minutes' }),
  prefix: z.string().trim().toUpperCase().regex(/^[A-Z]{1,2}$/, { error: 'Use 1 or 2 letters' }),
  handledBy: idList(0),
  isActive: z.boolean(),
};

export const createServiceSchema = z.strictObject({
  ...serviceFields,
  handledBy: serviceFields.handledBy.default([]),
  isActive: serviceFields.isActive.default(true),
});

export const updateServiceSchema = z
  .strictObject(Object.fromEntries(Object.entries(serviceFields).map(([key, rule]) => [key, rule.optional()])))
  .refine(nonEmpty, { error: 'Nothing to update' });

const resourceFields = {
  name: text(80, 'Enter a name'),
  serviceIds: idList(1, 'Pick at least one service'),
  isActive: z.boolean(),
  isPaused: z.boolean(),
};

export const createResourceSchema = z.strictObject({
  name: resourceFields.name,
  serviceIds: resourceFields.serviceIds,
  isActive: resourceFields.isActive.default(true),
});

export const updateResourceSchema = z
  .strictObject(Object.fromEntries(Object.entries(resourceFields).map(([key, rule]) => [key, rule.optional()])))
  .refine(nonEmpty, { error: 'Nothing to update' });

export const bulkSchema = z.strictObject({
  ids: idList(1, 'Select at least one item'),
  action: z.enum(['activate', 'deactivate', 'delete'], { error: 'Use activate, deactivate, or delete' }),
});

/* --------------------------------------------- analytics and history */

export const analyticsQuery = z.strictObject({
  range: z.coerce.number().refine((n) => [7, 14, 30].includes(n), { error: 'Use 7, 14, or 30 days' }).default(14),
});

const historyFilters = {
  q: z.string().trim().max(80).optional(),
  status: z.enum(['WAITING', 'CALLED', 'SERVING', 'DONE', 'NO_SHOW', 'CANCELLED'], { error: 'Unknown status' }).optional(),
  serviceId: objectId.optional(),
  resourceId: objectId.optional(),
  days: z.coerce.number().refine((n) => [1, 7, 30, 90, 365].includes(n), { error: 'Use 1, 7, 30, 90, or 365 days' }).default(30),
};

export const customersQuery = z.strictObject({
  ...historyFilters,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(25),
});

export const customersCsvQuery = z.strictObject(historyFilters);

// GET /api/admin/activity?limit=20
export const activityQuery = z.strictObject({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/* --------------------------------------------------------- branding */

export const brandingSchema = z
  .strictObject({
    brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, { error: 'Use a colour like #0E9F8E' }).optional(),
    welcomeMessage: z.string().trim().max(120, { error: 'Keep it under 120 characters' }).optional(),
    hidePoweredBy: z.boolean().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { error: 'Nothing to update' });
