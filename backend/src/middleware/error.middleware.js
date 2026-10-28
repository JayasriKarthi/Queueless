import { z } from 'zod';
import mongoose from 'mongoose';
import multer from 'multer';
import { env } from '../config/env.js';
import { ApiError, ERROR_CODES } from '../utils/ApiError.js';

const isProduction = env.NODE_ENV === 'production';

const send = (res, status, code, message, details) =>
  res.status(status).json({ ok: false, error: { code, message, ...(details !== undefined && { details }) } });

// Last middleware in app.js. Every error becomes { ok: false, error: { code, message, details? } }.
// Express 5 forwards errors thrown in async handlers here automatically.
// eslint-disable-next-line no-unused-vars
export function errorMiddleware(err, req, res, next) {
  // If a response already started streaming, let Express close the connection.
  if (res.headersSent) return next(err);

  // Errors the API threw on purpose.
  if (err instanceof ApiError) {
    if (err.statusCode >= 500) console.error(err);
    return send(res, err.statusCode, err.code, err.message, err.details);
  }

  // Zod validation: one entry per invalid field.
  if (err instanceof z.ZodError) {
    const details = err.issues.map((issue) => ({ field: issue.path.join('.') || '(root)', message: issue.message }));
    return send(res, 400, 'VALIDATION_ERROR', 'Some fields are not valid', details);
  }

  // Body parser errors from express.json() and express.raw().
  if (err.type === 'entity.parse.failed') return send(res, 400, 'INVALID_JSON', 'The request body is not valid JSON');
  if (err.type === 'entity.too.large') return send(res, 413, 'PAYLOAD_TOO_LARGE', 'The request body is too large');

  // File uploads (multer): too large, too many files, or an unexpected form field.
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') return send(res, 413, 'FILE_TOO_LARGE', 'The file is too large');
    return send(res, 400, 'INVALID_UPLOAD', err.code === 'LIMIT_UNEXPECTED_FILE' ? `Unexpected file field "${err.field}"` : err.message);
  }

  // MongoDB unique index violation. Report which fields clashed, never their values.
  if (err.code === 11000) {
    return send(res, 409, ERROR_CODES.CONFLICT, 'This already exists', { fields: Object.keys(err.keyValue ?? err.keyPattern ?? {}) });
  }

  // Mongoose: a malformed id (for example /tokens/abc) or a failed schema rule.
  if (err instanceof mongoose.Error.CastError) return send(res, 400, 'INVALID_ID', `Invalid value for ${err.path}`);
  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    return send(res, 400, 'VALIDATION_ERROR', 'Some fields are not valid', details);
  }

  // Other client errors that carry their own status (from Express or its middleware).
  const status = err.statusCode ?? err.status;
  if (Number.isInteger(status) && status >= 400 && status < 500) {
    return send(res, status, ERROR_CODES.BAD_REQUEST, err.expose === false ? 'The request could not be processed' : err.message);
  }

  // Anything else is a bug or an outage: log the full stack, hide the details in production.
  console.error(err);
  return send(res, 500, ERROR_CODES.INTERNAL_ERROR, isProduction ? 'Something went wrong' : err.message || 'Something went wrong');
}

export default errorMiddleware;
