import mongoose from 'mongoose';
import { schemaOptions, ObjectId, businessRef } from './shared.js';

// Who or what serves customers: a doctor, a bank counter, a stylist.
const resourceSchema = new mongoose.Schema(
  {
    businessId: businessRef,
    name: { type: String, required: true, trim: true, maxlength: 80 },
    serviceIds: { type: [{ type: ObjectId, ref: 'Service' }], default: [] }, // services it can handle
    isActive: { type: Boolean, default: true }, // counts toward the plan's counter limit
    isPaused: { type: Boolean, default: false }, // temporarily not calling anyone
  },
  schemaOptions,
);

resourceSchema.index({ businessId: 1 });

export const Resource = mongoose.model('Resource', resourceSchema);
export default Resource;
