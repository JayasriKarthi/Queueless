import { ApiError, ERROR_CODES } from '../utils/ApiError.js';

// Public join routes only (use after publicBusiness). Viewing, leaving, or rating an existing
// token is never blocked, so people already waiting keep seeing their status when the
// owner pauses the queue. (joinQueue checks the same rules again for staff walk-ins.)
export function requireOpenQueue(req, res, next) {
  if (!req.business.isLive) throw ApiError.conflict(ERROR_CODES.NOT_LIVE, 'This queue is not open yet');
  if (!req.business.isOpen) throw ApiError.conflict(ERROR_CODES.CLOSED, 'This queue is closed right now');
  next();
}

export default requireOpenQueue;
