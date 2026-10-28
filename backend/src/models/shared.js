import mongoose from 'mongoose';

const PRIVATE_FIELDS = ['passwordHash', 'pinHash', 'tokenHash', 'guestSecretHash', 'resetTokenHash', 'resetTokenExpiresAt', '__v'];

// Applied to every schema: send `id` instead of `_id` (matching the frontend's shapes)
// and never let hashes leave the server, even through JSON.stringify or res.json().
const hidePrivate = (doc, ret) => {
  ret.id = String(ret._id);
  delete ret._id;
  PRIVATE_FIELDS.forEach((field) => delete ret[field]);
  return ret;
};

export const schemaOptions = {
  timestamps: true,
  toJSON: { transform: hidePrivate },
  toObject: { transform: hidePrivate },
};

export const { ObjectId } = mongoose.Schema.Types;

// A required reference to the business that owns a document (tenant isolation).
export const businessRef = { type: ObjectId, ref: 'Business', required: true };
