import { z } from 'zod';
import { BUSINESS_TYPES } from '../utils/constants.js';

// Copied from frontend/src/lib/validators.js and updated for Zod 4.

// Trim and lowercase first, then check the format, so "  Owner@Demo.com " is stored as "owner@demo.com".
export const emailRule = z
  .string({ error: 'Email is required' })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'Enter a valid email' }));

// bcrypt only uses the first 72 bytes of a password, so longer ones are refused.
export const passwordRule = z
  .string({ error: 'Password is required' })
  .min(8, { error: 'Use at least 8 characters' })
  .max(72, { error: 'Use at most 72 characters' });

export const signupSchema = z.object({
  name: z.string({ error: 'Enter your full name' }).trim().min(2, { error: 'Enter your full name' }).max(80),
  email: emailRule,
  password: passwordRule,
  businessName: z.string({ error: 'Enter your business name' }).trim().min(2, { error: 'Enter your business name' }).max(80),
  businessType: z.enum(BUSINESS_TYPES, { error: 'Pick a business type' }),
  terms: z.literal(true, { error: 'Please accept the terms to continue' }),
  // The plan picked on the pricing page (/signup?plan=pro), remembered for the plan step.
  plan: z.enum(['free', 'pro', 'business'], { error: 'Unknown plan' }).optional(),
});

export const forgotPasswordSchema = z.object({
  email: emailRule,
});

export const resetPasswordSchema = z.object({
  token: z.string({ error: 'This reset link is not valid' }).min(20, { error: 'This reset link is not valid' }).max(200),
  password: passwordRule,
});

export const loginSchema = z.object({
  email: emailRule,
  password: z.string({ error: 'Password is required' }).min(1, { error: 'Password is required' }),
});
