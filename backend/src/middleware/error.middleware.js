import { env } from '../config/env.js';

// Last middleware in app.js. Phase 3 extends this with ApiError, Zod, and MongoDB cases.
// Express 5 forwards errors thrown in async handlers here automatically.
// eslint-disable-next-line no-unused-vars
export function errorMiddleware(err, req, res, next) {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ ok: false, error: { code: 'INVALID_JSON', message: 'The request body is not valid JSON' } });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ ok: false, error: { code: 'PAYLOAD_TOO_LARGE', message: 'The request body is too large' } });
  }

  const status = Number.isInteger(err.statusCode ?? err.status) ? err.statusCode ?? err.status : 500;
  if (status >= 500) console.error(err);

  res.status(status).json({
    ok: false,
    error: {
      code: err.code && typeof err.code === 'string' ? err.code : status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_FAILED',
      // Never expose internal error details in production.
      message: status >= 500 && env.NODE_ENV === 'production' ? 'Something went wrong' : err.message,
    },
  });
}

export default errorMiddleware;
