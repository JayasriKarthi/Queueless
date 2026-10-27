import mongoose from 'mongoose';
import { schemaOptions } from './shared.js';

// A "Contact sales" form submission from the marketing site. Not owned by a business.
const enterpriseLeadSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, lowercase: true, trim: true },
    company: { type: String, required: true, trim: true, maxlength: 120 },
    locations: { type: Number, required: true, min: 1 },
    message: { type: String, trim: true, maxlength: 1000, default: '' },
    status: { type: String, enum: ['new', 'contacted', 'won', 'lost'], default: 'new' },
  },
  schemaOptions,
);

enterpriseLeadSchema.index({ createdAt: -1 });

export const EnterpriseLead = mongoose.model('EnterpriseLead', enterpriseLeadSchema);
export default EnterpriseLead;
