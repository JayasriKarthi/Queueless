import { ApiError } from '../utils/ApiError.js';
import { ROLES } from '../utils/constants.js';

// Use after requireAuth: requireRole('owner') or requireRole('staff', 'manager').
export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) throw ApiError.unauthorized();
  if (!roles.includes(req.user.role)) throw ApiError.forbidden('FORBIDDEN', 'Your role does not have access to this');
  next();
};

export const requireOwner = requireRole(ROLES.OWNER);
export const requireStaff = requireRole(ROLES.STAFF, ROLES.MANAGER);

export default requireRole;
