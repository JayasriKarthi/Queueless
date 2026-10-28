import mongoose from 'mongoose';
import { schemaOptions, ObjectId, businessRef } from './shared.js';
import { TOKEN_STATUS, TOKEN_SOURCES } from '../utils/constants.js';

// Name and phone are always asked. strict: false keeps the business's extra join-form
// fields (age, reason, account number...), which are validated per request in Phase 9.
const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    phone: { type: String, required: true, match: /^[6-9]\d{9}$/ },
  },
  { _id: false, strict: false },
);

// One customer's place in a line, for example A-024.
const tokenSchema = new mongoose.Schema(
  {
    businessId: businessRef,
    queueKey: { type: String, required: true },
    number: { type: Number, required: true, min: 1 },
    code: { type: String, required: true }, // shown to people: "A-024"
    day: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ }, // the business's local date when the token was taken
    // Set to the customer's phone while the token is active, removed when it finishes.
    // A unique index on it means one phone can never hold two active tokens at once.
    activePhone: { type: String },
    serviceId: { type: ObjectId, ref: 'Service', required: true },
    resourceId: { type: ObjectId, ref: 'Resource', default: null }, // set when called (or the chosen doctor)
    customer: { type: customerSchema, required: true },
    priority: { type: Boolean, default: false },
    status: { type: String, enum: Object.values(TOKEN_STATUS), default: TOKEN_STATUS.WAITING },
    source: { type: String, enum: Object.values(TOKEN_SOURCES), default: TOKEN_SOURCES.QR },
    calledAt: { type: Date, default: null },
    servedAt: { type: Date, default: null },
    doneAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    cancelledBy: { type: String, enum: ['customer', 'staff', 'system', null], default: null },
    sortAt: { type: Date, default: Date.now }, // place in line; "Skip to end" moves it to now
    recalls: { type: Number, default: 0 },
    rating: { type: Number, min: 1, max: 5, default: null },
    // Hash of the secret given to the customer's phone. It proves the phone owns this token
    // before it can leave the line or rate a visit. Never sent back in API responses.
    guestSecretHash: { type: String, required: true },
  },
  schemaOptions,
);

// Waiting list for a line, in call order: priority first, then place in line.
tokenSchema.index({ businessId: 1, status: 1, queueKey: 1, priority: -1, sortAt: 1 });
// Customer history, analytics, and "tokens issued today".
tokenSchema.index({ businessId: 1, createdAt: -1 });
// "This phone already has an active token" check.
tokenSchema.index({ businessId: 1, 'customer.phone': 1, status: 1 });
// One active token per phone per business, enforced by the database even for simultaneous joins.
tokenSchema.index({ businessId: 1, activePhone: 1 }, { unique: true, partialFilterExpression: { activePhone: { $exists: true } } });
// Tokens per day (daily totals and analytics).
tokenSchema.index({ businessId: 1, day: 1 });

export const Token = mongoose.model('Token', tokenSchema);
export default Token;
