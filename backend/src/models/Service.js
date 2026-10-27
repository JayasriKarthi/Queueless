import mongoose from 'mongoose';
import { schemaOptions, businessRef } from './shared.js';

// What customers queue for, for example "General consultation" or "Cash deposit".
const serviceSchema = new mongoose.Schema(
  {
    businessId: businessRef,
    name: { type: String, required: true, trim: true, maxlength: 80 },
    avgMinutes: { type: Number, required: true, min: 1, max: 240 }, // used for wait estimates
    prefix: { type: String, required: true, match: /^[A-Z]{1,2}$/ }, // tokens look like A-001
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  schemaOptions,
);

serviceSchema.index({ businessId: 1, sortOrder: 1 });

export const Service = mongoose.model('Service', serviceSchema);
export default Service;
