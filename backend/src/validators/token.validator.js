import { z } from 'zod';
import { objectId } from './business.validator.js';

// The fixed part of a join request. `customer` is checked separately against the
// business's own join form (buildCustomerSchema), because every business asks different things.
export const joinSchema = z.strictObject({
  serviceId: objectId.optional(),
  resourceId: z.union([objectId, z.literal('any')]).optional(),
  customer: z.record(z.string(), z.unknown(), { error: 'Fill in your details' }),
  priority: z.boolean().optional(),
});

// Public status page: /api/public/:slug/tokens/:id
export const tokenStatusParams = z.object({ slug: z.string(), id: objectId });

// Customer actions on their own token. The guestSecret was returned once, when they joined.
const guestSecret = z.string({ error: 'This link is missing its secret. Open the token page from the same phone.' }).min(10).max(200);
export const leaveSchema = z.strictObject({ guestSecret });
export const rateSchema = z.strictObject({
  guestSecret,
  rating: z.number({ error: 'Choose 1 to 5 stars' }).int({ error: 'Choose 1 to 5 stars' }).min(1, { error: 'Choose 1 to 5 stars' }).max(5, { error: 'Choose 1 to 5 stars' }),
});

// Staff actions
export const callTokenSchema = z.strictObject({ resourceId: objectId.optional() });
export const pauseSchema = z.strictObject({ isPaused: z.boolean({ error: 'Send isPaused: true or false' }) });
export const consoleQuery = z.strictObject({ resourceId: objectId.optional() });

const blankToUndefined = (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value);

// Indian mobile numbers. Spaces, dashes, and a leading +91, 91, or 0 are removed, so
// "98765 43210", "+91 98765-43210", and "09876543210" are all the same phone.
export const phoneRule = z
  .string({ error: 'Enter a 10-digit mobile number' })
  .transform((value) => value.replace(/[\s-]/g, '').replace(/^(\+?91|0)(?=\d{10}$)/, ''))
  .pipe(z.string().regex(/^[6-9]\d{9}$/, { error: 'Enter a 10-digit mobile number' }));

function ruleFor(field) {
  if (field.key === 'phone') return phoneRule;
  if (field.key === 'name') return z.string({ error: 'Enter your name' }).trim().min(2, { error: 'Enter your name' }).max(80);

  const missing = `${field.label} is required`;
  let rule;
  switch (field.type) {
    case 'number':
      rule = z.coerce.number({ error: 'Enter a number' }).min(0, { error: 'Enter a number of 0 or more' }).max(100000);
      break;
    case 'email':
      rule = z.string({ error: missing }).trim().toLowerCase().pipe(z.email({ error: 'Enter a valid email' }));
      break;
    case 'select':
      rule = z.enum(field.options?.length ? field.options : ['__none__'], { error: `Choose one of the options for ${field.label}` });
      break;
    case 'textarea':
      rule = z.string({ error: missing }).trim().min(1, { error: missing }).max(1000);
      break;
    default:
      rule = z.string({ error: missing }).trim().min(1, { error: missing }).max(200);
  }
  // Empty answers count as "not given": an error if required, otherwise simply left out.
  return z.preprocess(blankToUndefined, field.required ? rule : rule.optional());
}

// Builds the customer rules from the business's join form. Name and phone are always required.
// Answers to questions the form does not ask are dropped, so nothing extra can be stored.
export function buildCustomerSchema(customerFields = []) {
  const shape = Object.fromEntries(customerFields.map((field) => [field.key, ruleFor(field)]));
  shape.name = ruleFor({ key: 'name' });
  shape.phone = ruleFor({ key: 'phone' });
  return z.object(shape);
}
