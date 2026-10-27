import mongoose from 'mongoose';
import { schemaOptions, ObjectId, businessRef } from './shared.js';
import { ROLES } from '../utils/constants.js';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true }, // bcrypt, never the plain password
    role: { type: String, enum: Object.values(ROLES), required: true },
    businessId: businessRef,
    resourceId: { type: ObjectId, ref: 'Resource', default: null }, // the counter or doctor a staff member serves
    pinHash: { type: String }, // bcrypt of the 4-digit PIN used for "Switch user"
    status: { type: String, enum: ['active', 'deactivated'], default: 'active' },
    lastLoginAt: { type: Date },
    avatarColor: { type: String, default: '#0E9F8E' },
    refreshTokenVersion: { type: Number, default: 0 }, // bump to log the user out everywhere
  },
  schemaOptions,
);

userSchema.index({ businessId: 1, role: 1 });

export const User = mongoose.model('User', userSchema);
export default User;
