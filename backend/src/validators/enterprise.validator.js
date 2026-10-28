import { z } from 'zod';
import { FREE_EMAIL_DOMAINS } from '../utils/constants.js';

// POST /api/enterprise/leads: the "Contact sales" form on the pricing page.
export const enterpriseLeadSchema = z.strictObject({
  name: z.string({ error: 'Enter your name' }).trim().min(2, { error: 'Enter your name' }).max(80),
  email: z
    .string({ error: 'Enter your work email' })
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: 'Enter a valid work email' }))
    .refine((email) => !FREE_EMAIL_DOMAINS.includes(email.split('@')[1]), { error: 'Use your work email, not a personal one like Gmail' }),
  company: z.string({ error: 'Enter your company name' }).trim().min(2, { error: 'Enter your company name' }).max(120),
  locations: z.number({ error: 'How many locations do you have?' }).int().min(1, { error: 'At least 1 location' }).max(10000),
  message: z.string().trim().max(1000, { error: 'Keep the message under 1000 characters' }).optional(),
});
