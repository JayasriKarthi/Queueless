import mongoose from 'mongoose';
import { schemaOptions, businessRef } from './shared.js';
import { PLAN_IDS } from '../utils/constants.js';

// The business's paid plan as the payment provider sees it. Updated only by verified webhooks.
const subscriptionSchema = new mongoose.Schema(
  {
    businessId: { ...businessRef, unique: true },
    plan: { type: String, enum: PLAN_IDS, required: true },
    cycle: { type: String, enum: ['monthly', 'yearly'], default: 'monthly' },
    status: { type: String, enum: ['trialing', 'active', 'past_due', 'cancelled'], required: true },
    provider: { type: String, enum: ['stripe', 'razorpay'], default: 'stripe' },
    providerCustomerId: { type: String },
    providerSubscriptionId: { type: String },
    currentPeriodEnd: { type: Date },
    trialEndsAt: { type: Date },
    cancelAtPeriodEnd: { type: Boolean, default: false },
  },
  schemaOptions,
);

subscriptionSchema.index({ providerSubscriptionId: 1 });

export const Subscription = mongoose.model('Subscription', subscriptionSchema);
export default Subscription;
