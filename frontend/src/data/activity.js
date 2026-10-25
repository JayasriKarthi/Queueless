const MIN = 60000;

export function seedActivity(now = Date.now()) {
  const a = (id, businessId, minsAgo, kind, text) => ({ id, businessId, at: now - minsAgo * MIN, kind, text });
  return [
    a('act_1', 'biz_citycare', 4, 'call', 'Dr. Ananya Rao called the next token'),
    a('act_2', 'biz_citycare', 18, 'join', '6 customers joined from the QR code in the last hour'),
    a('act_3', 'biz_citycare', 55, 'staff', 'Lakshmi Nair logged in to the staff console'),
    a('act_4', 'biz_citycare', 190, 'settings', 'Queue rules updated: priority for seniors turned on'),
    a('act_5', 'biz_citycare', 1440, 'invite', 'Invite sent to kavya.reddy@citycare.example'),
    a('act_6', 'biz_citycare', 2880, 'rating', 'A customer rated their visit 5 stars'),
    a('act_7', 'biz_unitedbank', 6, 'call', 'Counter 2 called the next token'),
    a('act_8', 'biz_unitedbank', 40, 'join', '14 customers joined in the last hour'),
    a('act_9', 'biz_unitedbank', 600, 'billing', 'Business plan renewed'),
    a('act_10', 'biz_canteen', 3, 'call', 'Pickup counter called the next token'),
    a('act_11', 'biz_canteen', 300, 'settings', 'Link changed from college-canteen to campus-canteen'),
    a('act_12', 'biz_glow', 120, 'settings', 'Business created from the salon template'),
  ];
}

export function seedNotifications(now = Date.now()) {
  const n = (id, businessId, minsAgo, title, body, read = false) => ({ id, businessId, at: now - minsAgo * MIN, title, body, read });
  return [
    n('ntf_1', 'biz_citycare', 12, 'Line is getting long', 'Dr. Ananya Rao has 4 or more people waiting.'),
    n('ntf_2', 'biz_citycare', 300, 'Invite expiring soon', 'The invite for arjun.das@citycare.example expires tomorrow.'),
    n('ntf_3', 'biz_citycare', 2000, 'Weekly summary ready', 'You served 412 customers last week, 9% more than the week before.', true),
    n('ntf_4', 'biz_unitedbank', 30, 'SMS credits at 42%', 'You have used 212 of 500 SMS this month.'),
    n('ntf_5', 'biz_canteen', 60, 'Old link still in use', 'People are still scanning college-canteen. It redirects for 62 more days.'),
  ];
}
