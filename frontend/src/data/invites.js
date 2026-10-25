import { DAY_MS } from '../config/constants';

// Two pending (one expiring soon), one expired, one revoked.
export function seedInvites(now = Date.now()) {
  const make = (id, token, email, role, resourceId, status, createdDaysAgo, extra = {}) => ({
    id, token, businessId: 'biz_citycare', email, role, resourceId, status,
    createdAt: now - createdDaysAgo * DAY_MS, expiresAt: now - createdDaysAgo * DAY_MS + 7 * DAY_MS, invitedBy: 'usr_owner_cc', ...extra,
  });
  return [
    make('inv_1', 'demo-invite-pending', 'kavya.reddy@citycare.example', 'staff', 'res_cc_1', 'pending', 1),
    make('inv_2', 'demo-invite-soon', 'arjun.das@citycare.example', 'manager', 'res_cc_2', 'pending', 6.6),
    make('inv_3', 'demo-invite-expired', 'sneha.patel@citycare.example', 'staff', 'res_cc_3', 'pending', 12),
    make('inv_4', 'demo-invite-revoked', 'rahul.verma@citycare.example', 'staff', 'res_cc_1', 'revoked', 4, { revokedAt: now - 3 * DAY_MS }),
    { id: 'inv_5', token: 'demo-invite-bank', businessId: 'biz_unitedbank', email: 'new.teller@unitedbank.example', role: 'staff', resourceId: 'res_ub_1', status: 'pending', createdAt: now - 2 * DAY_MS, expiresAt: now + 5 * DAY_MS, invitedBy: 'usr_owner_ub' },
  ];
}
