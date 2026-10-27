import mongoose from 'mongoose';
import { schemaOptions, businessRef } from './shared.js';

const invoiceSchema = new mongoose.Schema(
  {
    businessId: businessRef,
    number: { type: String, required: true, unique: true }, // for example QL-10234
    date: { type: Date, required: true },
    plan: { type: String, required: true }, // for example "Pro (monthly)"
    amount: { type: Number, required: true, min: 0 }, // in paise (₹999 = 99900) to avoid rounding errors
    currency: { type: String, default: 'INR' },
    status: { type: String, enum: ['paid', 'trial', 'open', 'failed', 'refunded'], required: true },
    providerInvoiceId: { type: String },
    pdfUrl: { type: String },
  },
  schemaOptions,
);

invoiceSchema.index({ businessId: 1, date: -1 });

export const Invoice = mongoose.model('Invoice', invoiceSchema);
export default Invoice;
