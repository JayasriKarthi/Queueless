// Error codes the frontend already reacts to (see frontend/src/lib/fakeBackend.js),
// plus the shared codes used across the API.
export const ERROR_CODES = Object.freeze({
  NOT_LIVE: 'not_live',
  CLOSED: 'closed',
  LIMIT: 'limit',
  SEAT_LIMIT: 'seat_limit',
  WRONG_PIN: 'wrong_pin',
  LOCKED: 'locked',
  INVALID: 'invalid',
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  ACCESS_DENIED: 'ACCESS_DENIED',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  PLAN_LIMIT: 'PLAN_LIMIT',
  PLAN_REQUIRED: 'PLAN_REQUIRED',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
});

// An error the API means to send to the client: an HTTP status, a machine-readable code,
// a readable message, and optional details (for example { limitKey, used, limit }).
export class ApiError extends Error {
  constructor(statusCode, code, message, details) {
    super(message ?? code);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    if (details !== undefined) this.details = details;
    Error.captureStackTrace?.(this, ApiError);
  }

  toJSON() {
    return { code: this.code, message: this.message, ...(this.details !== undefined && { details: this.details }) };
  }

  static badRequest(code = ERROR_CODES.BAD_REQUEST, message = 'The request is not valid', details) {
    return new ApiError(400, code, message, details);
  }

  static unauthorized(code = ERROR_CODES.UNAUTHORIZED, message = 'Please log in to continue', details) {
    return new ApiError(401, code, message, details);
  }

  static paymentRequired(code = ERROR_CODES.PLAN_REQUIRED, message = 'This feature needs a paid plan', details) {
    return new ApiError(402, code, message, details);
  }

  static forbidden(code = ERROR_CODES.FORBIDDEN, message = 'You do not have access to this', details) {
    return new ApiError(403, code, message, details);
  }

  static notFound(code = ERROR_CODES.NOT_FOUND, message = 'Not found', details) {
    return new ApiError(404, code, message, details);
  }

  static conflict(code = ERROR_CODES.CONFLICT, message = 'This conflicts with existing data', details) {
    return new ApiError(409, code, message, details);
  }

  static gone(code = ERROR_CODES.INVALID, message = 'This link is no longer valid', details) {
    return new ApiError(410, code, message, details);
  }

  static locked(code = ERROR_CODES.LOCKED, message = 'Too many attempts. Try again shortly.', details) {
    return new ApiError(423, code, message, details);
  }

  static tooManyRequests(code = ERROR_CODES.TOO_MANY_REQUESTS, message = 'Too many requests. Slow down and try again.', details) {
    return new ApiError(429, code, message, details);
  }

  static internal(code = ERROR_CODES.INTERNAL_ERROR, message = 'Something went wrong', details) {
    return new ApiError(500, code, message, details);
  }
}

export default ApiError;

