import { z } from 'zod';
import { emailRule, passwordRule } from './auth.validator.js';
import { objectId } from './business.validator.js';
import { STAFF_ROLES } from '../utils/constants.js';

export const createInviteSchema = z.strictObject({
  email: emailRule,
  role: z.enum(STAFF_ROLES, { error: 'Choose staff or manager' }).default('staff'),
  resourceId: objectId,
});

// Owner changes to a staff member: a different resource (null unassigns) or role.
export const updateStaffSchema = z
  .strictObject({
    resourceId: objectId.nullable().optional(),
    role: z.enum(STAFF_ROLES, { error: 'Choose staff or manager' }).optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { error: 'Nothing to update' });

// "Switch user" on a shared front-desk computer.
export const switchUserSchema = z.strictObject({
  userId: objectId,
  pin: z.string({ error: 'Enter the 4-digit PIN' }).regex(/^\d{4}$/, { error: 'Enter the 4-digit PIN' }),
});

// Invite links carry a 32-character random token (letters, digits, - and _).
export const inviteTokenParams = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{32}$/, { error: 'This invite link is not valid' }),
});

export const acceptInviteSchema = z
  .strictObject({
    name: z.string({ error: 'Enter your full name' }).trim().min(2, { error: 'Enter your full name' }).max(80),
    password: passwordRule,
    confirm: z.string({ error: 'Confirm your password' }),
    // Optional: used to switch users quickly on a shared front-desk computer. One is made up if left out.
    pin: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().regex(/^\d{4}$/, { error: 'PIN must be 4 digits' }).optional(),
    ),
  })
  .refine((body) => body.password === body.confirm, { error: 'Passwords do not match', path: ['confirm'] });
