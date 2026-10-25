import { z } from 'zod';
import { RESERVED_SLUGS } from '../config/constants';

export const phoneRule = z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a 10-digit mobile number');
export const emailRule = z.string().trim().min(1, 'Email is required').email('Enter a valid email');
export const passwordRule = z.string().min(8, 'Use at least 8 characters');

export function passwordStrength(pw = '') {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const level = Math.min(4, score);
  return { score: level, label: ['Too short', 'Weak', 'Fair', 'Good', 'Strong'][level] };
}

export const signupSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name'),
  email: emailRule,
  password: passwordRule,
  businessName: z.string().trim().min(2, 'Enter your business name'),
  businessType: z.string().min(1, 'Pick a business type'),
  terms: z.literal(true, { errorMap: () => ({ message: 'Please accept the terms to continue' }) }),
});

export const loginSchema = z.object({
  email: emailRule,
  password: z.string().min(1, 'Password is required'),
});

export const contactSalesSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name'),
  email: emailRule.refine((v) => !/@(gmail|yahoo|hotmail|outlook)\./i.test(v), 'Please use your work email'),
  company: z.string().trim().min(2, 'Enter your company name'),
  locations: z.coerce.number({ invalid_type_error: 'Enter a number' }).int().min(1, 'At least 1 location'),
  message: z.string().trim().max(1000, 'Keep it under 1000 characters').optional(),
});

export const serviceSchema = z.object({
  name: z.string().trim().min(2, 'Enter a name'),
  avgMinutes: z.coerce.number({ invalid_type_error: 'Enter minutes' }).int().min(1, 'At least 1 minute').max(240, 'At most 240 minutes'),
  prefix: z.string().trim().regex(/^[A-Z]{1,2}$/, 'Use 1 or 2 capital letters'),
  handledBy: z.array(z.string()),
  isActive: z.boolean(),
});

export const resourceSchema = z.object({
  name: z.string().trim().min(2, 'Enter a name'),
  serviceIds: z.array(z.string()).min(1, 'Pick at least one service'),
  isActive: z.boolean(),
});

export const acceptInviteSchema = z
  .object({
    name: z.string().trim().min(2, 'Enter your full name'),
    password: passwordRule,
    confirm: z.string(),
    pin: z.string().regex(/^(\d{4})?$/, 'PIN must be 4 digits').optional(),
  })
  .refine((d) => d.password === d.confirm, { path: ['confirm'], message: 'Passwords do not match' });

export const inviteSchema = z.object({
  email: emailRule,
  role: z.enum(['staff', 'manager']),
  resourceId: z.string().min(1, 'Assign a resource'),
});

export const checkoutSchema = z.object({
  cardName: z.string().trim().min(2, 'Enter the name on the card'),
  cardNumber: z.string().transform((v) => v.replace(/\s/g, '')).pipe(z.string().regex(/^\d{16}$/, 'Card number must be 16 digits')),
  expiry: z.string().regex(/^(0[1-9]|1[0-2])\/\d{2}$/, 'Use MM/YY').refine((v) => {
    const [m, y] = v.split('/').map(Number);
    return new Date(2000 + y, m) > new Date();
  }, 'This card has expired'),
  cvc: z.string().regex(/^\d{3,4}$/, '3 or 4 digits'),
});

export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/;
export function slugProblem(slug) {
  if (!slug) return 'Enter a link name';
  if (slug.length < 3) return 'Use at least 3 characters';
  if (!SLUG_PATTERN.test(slug)) return 'Use lowercase letters, numbers, and hyphens. No hyphen at the start or end.';
  if (RESERVED_SLUGS.includes(slug)) return 'This name is reserved';
  return null;
}

// Builds a join-form schema from the business's custom fields.
export function buildJoinSchema(fields) {
  const shape = {};
  fields.forEach((f) => {
    let rule;
    if (f.key === 'phone') rule = phoneRule;
    else if (f.key === 'name') rule = z.string().trim().min(2, 'Enter your name');
    else if (f.type === 'number') {
      rule = z.preprocess((v) => (v === '' || v == null ? undefined : Number(v)), f.required ? z.number({ required_error: `${f.label} is required`, invalid_type_error: 'Enter a number' }).min(0).max(150) : z.number().min(0).max(150).optional());
    } else if (f.type === 'email') rule = f.required ? emailRule : z.union([z.literal(''), emailRule]).optional();
    else rule = f.required ? z.string().trim().min(1, `${f.label} is required`) : z.string().optional();
    shape[f.key] = rule;
  });
  shape.priority = z.boolean().optional();
  return z.object(shape);
}
