import { DEMO_PASSWORD, DAY_MS } from '../config/constants';

const AVATAR_COLORS = ['#0E9F8E', '#2563EB', '#7C3AED', '#DB2777', '#EA580C', '#CA8A04'];

const owner = (id, name, email, businessId, now) => ({
  id, name, email, password: DEMO_PASSWORD, role: 'owner', businessId, resourceId: null, pin: '1111', status: 'active',
  lastLoginAt: now - 2 * 3600000, createdAt: now - 120 * DAY_MS, avatarColor: '#0B1F1C',
});

const staff = (id, name, email, businessId, resourceId, pin, lastLoginHoursAgo, i, now, role = 'staff') => ({
  id, name, email, password: DEMO_PASSWORD, role, businessId, resourceId, pin, status: 'active',
  lastLoginAt: now - lastLoginHoursAgo * 3600000, createdAt: now - 60 * DAY_MS, avatarColor: AVATAR_COLORS[i % AVATAR_COLORS.length],
});

export function seedUsers(now = Date.now()) {
  return [
    // Main demo accounts
    owner('usr_owner_cc', 'Meera Krishnan', 'owner@demo.com', 'biz_citycare', now),
    staff('usr_staff_cc1', 'Rohan Iyer', 'staff@demo.com', 'biz_citycare', 'res_cc_1', '1234', 1, 0, now),
    staff('usr_staff_cc2', 'Lakshmi Nair', 'lakshmi@citycare.example', 'biz_citycare', 'res_cc_2', '2345', 5, 1, now),
    staff('usr_staff_cc3', 'Imran Khan', 'imran@citycare.example', 'biz_citycare', 'res_cc_3', '3456', 26, 2, now, 'manager'),

    // A second business, used to prove tenant isolation
    owner('usr_owner_ub', 'Suresh Reddy', 'owner.bank@demo.com', 'biz_unitedbank', now),
    staff('usr_staff_ub1', 'Priya Sharma', 'staff.bank@demo.com', 'biz_unitedbank', 'res_ub_1', '1234', 2, 3, now),
    staff('usr_staff_ub2', 'Karthik Subramanian', 'karthik@unitedbank.example', 'biz_unitedbank', 'res_ub_2', '4567', 3, 4, now),
    staff('usr_staff_ub3', 'Fatima Ahmed', 'fatima@unitedbank.example', 'biz_unitedbank', 'res_ub_3', '5678', 30, 5, now, 'manager'),

    owner('usr_owner_cn', 'Gurpreet Kaur', 'owner.canteen@demo.com', 'biz_canteen', now),
    staff('usr_staff_cn1', 'Arun Pillai', 'staff.canteen@demo.com', 'biz_canteen', 'res_cn_1', '1234', 1, 0, now),
    staff('usr_staff_cn2', 'Divya Joshi', 'divya@campus.example', 'biz_canteen', 'res_cn_1', '6789', 8, 1, now),
    staff('usr_staff_cn3', 'Joseph Fernandes', 'joseph@campus.example', 'biz_canteen', 'res_cn_1', '7890', 48, 2, now),

    owner('usr_owner_gl', 'Neha Desai', 'owner.salon@demo.com', 'biz_glow', now),
  ];
}
