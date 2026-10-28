import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ quiet: true });

// Empty lines in .env (KEY=) count as "not set", so defaults and .optional() apply.
const blankToUndefined = (value) => (value === '' ? undefined : value);
const optionalText = z.preprocess(blankToUndefined, z.string().optional());

const schema = z.object({
  NODE_ENV: z.preprocess(blankToUndefined, z.enum(['development', 'test', 'production']).default('development')),
  PORT: z.preprocess(blankToUndefined, z.coerce.number().int().positive().default(4000)),
  CLIENT_URL: z.url(),

  MONGO_URI: z.string().min(1),
  REDIS_URL: z.string().min(1),

  JWT_ACCESS_SECRET: z.string().min(16, 'Use at least 16 characters'),
  JWT_REFRESH_SECRET: z.string().min(16, 'Use at least 16 characters'),
  JWT_ACCESS_TTL: z.preprocess(blankToUndefined, z.string().default('15m')),
  JWT_REFRESH_TTL: z.preprocess(blankToUndefined, z.string().default('30d')),

  INVITE_EXPIRY_DAYS: z.preprocess(blankToUndefined, z.coerce.number().int().positive().default(7)),
  SLUG_REDIRECT_DAYS: z.preprocess(blankToUndefined, z.coerce.number().int().positive().default(90)),

  // Providers are optional until the phases that use them (payments, SMS, email, uploads).
  STRIPE_SECRET_KEY: optionalText, // sk_test_... from the Stripe dashboard; checkout is off without it
  STRIPE_WEBHOOK_SECRET: optionalText, // whsec_... from `stripe listen` or the dashboard's webhook page
  RAZORPAY_KEY_ID: optionalText,
  RAZORPAY_KEY_SECRET: optionalText,
  RAZORPAY_WEBHOOK_SECRET: optionalText,
  SMS_PROVIDER_KEY: optionalText,
  EMAIL_FROM: z.preprocess(blankToUndefined, z.string().default('QueueLess <no-reply@queueless.app>')),
  EMAIL_API_KEY: optionalText,
  CLOUDINARY_URL: optionalText,
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error(`Invalid environment settings in .env:\n${z.prettifyError(parsed.error)}`);
  process.exit(1);
}

if (parsed.data.NODE_ENV === 'production' && parsed.data.JWT_ACCESS_SECRET === parsed.data.JWT_REFRESH_SECRET) {
  console.error('Invalid environment settings: JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different.');
  process.exit(1);
}

export const env = Object.freeze(parsed.data);
