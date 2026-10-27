import mongoose from 'mongoose';
import { schemaOptions, businessRef } from './shared.js';

// An old public link that still redirects to the business's new one (for 90 days),
// so printed QR codes keep working for a while after a rename.
const slugHistorySchema = new mongoose.Schema(
  {
    businessId: businessRef,
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    redirectUntil: { type: Date, required: true },
  },
  schemaOptions,
);

// MongoDB deletes the document automatically once redirectUntil has passed.
slugHistorySchema.index({ redirectUntil: 1 }, { expireAfterSeconds: 0 });

export const SlugHistory = mongoose.model('SlugHistory', slugHistorySchema);
export default SlugHistory;
