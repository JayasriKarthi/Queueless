import mongoose from 'mongoose';
import { schemaOptions, ObjectId, businessRef } from './shared.js';
import { STAFF_ROLES } from '../utils/constants.js';

// An emailed invite link. Only the SHA-256 hash of the link's token is stored,
// so a database leak does not expose links that still work.
const staffInviteSchema = new mongoose.Schema(
  {
    businessId: businessRef,
    email: { type: String, required: true, lowercase: true, trim: true },
    role: { type: String, enum: STAFF_ROLES, default: 'staff' },
    resourceId: { type: ObjectId, ref: 'Resource' },
    tokenHash: { type: String, required: true, unique: true },
    status: { type: String, enum: ['pending', 'accepted', 'revoked'], default: 'pending' },
    expiresAt: { type: Date, required: true }, // "expired" = pending and past this date
    invitedBy: { type: ObjectId, ref: 'User' },
    acceptedAt: { type: Date },
    revokedAt: { type: Date },
    userId: { type: ObjectId, ref: 'User' }, // the account created on acceptance
  },
  schemaOptions,
);

staffInviteSchema.index({ businessId: 1, email: 1 });

export const StaffInvite = mongoose.model('StaffInvite', staffInviteSchema);
export default StaffInvite;
