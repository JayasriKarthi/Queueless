import { DAY_MS } from '../config/constants';

export function seedInvoices(now = Date.now()) {
  const inv = (id, businessId, daysAgo, plan, amount, status = 'Paid') => ({ id, businessId, number: id.toUpperCase().replace('_', '-'), date: now - daysAgo * DAY_MS, plan, amount, status });
  return [
    inv('inv_ub_2401', 'biz_unitedbank', 40, 'Business (yearly)', 28790),
    inv('inv_ub_2312', 'biz_unitedbank', 405, 'Business (yearly)', 28790),
    inv('inv_cn_2410', 'biz_canteen', 12, 'Pro (monthly)', 999),
    inv('inv_cn_2409', 'biz_canteen', 42, 'Pro (monthly)', 999),
    inv('inv_cn_2408', 'biz_canteen', 72, 'Pro (monthly)', 999),
    inv('inv_cn_2407', 'biz_canteen', 103, 'Pro (monthly)', 999, 'Refunded'),
  ];
}
