import mongoose from 'mongoose';
import { schemaOptions } from './shared.js';

const RETENTION_DAYS = 90;

// Payment provider events already handled. Stripe can send the same event more than once,
// so each event id is recorded (in the same transaction as its changes) and repeats are skipped.
const webhookEventSchema = new mongoose.Schema(
  {
    provider: { type: String, enum: ['stripe', 'razorpay'], default: 'stripe' },
    eventId: { type: String, required: true },
    type: { type: String, required: true },
  },
  schemaOptions,
);

webhookEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });
// Stripe retries for at most a few days, so old records are removed after 90.
webhookEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: RETENTION_DAYS * 24 * 60 * 60 });

export const WebhookEvent = mongoose.model('WebhookEvent', webhookEventSchema);
export default WebhookEvent;
