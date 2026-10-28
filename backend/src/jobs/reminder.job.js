import { Business } from '../models/Business.js';
import { StaffInvite } from '../models/StaffInvite.js';
import { DAY_MS } from '../utils/constants.js';
import { dateKey } from '../utils/tokenNumber.js';
import { notifyAdmin } from '../services/notification.service.js';
import { summaryForDay } from '../services/analytics.service.js';

// Every minute: tell owners about invites that expire within 24 hours (once per invite link).
export async function runInviteReminders(now = new Date()) {
  const soon = await StaffInvite.find({ status: 'pending', expiresAt: { $gt: now, $lte: new Date(now.getTime() + DAY_MS) } });
  let sent = 0;
  for (const invite of soon) {
    const hours = Math.max(1, Math.round((invite.expiresAt.getTime() - now.getTime()) / 3600000));
    // The expiry is part of the key: a resent invite gets its own reminder later.
    const note = await notifyAdmin(invite.businessId, {
      kind: 'invite_expiring',
      title: 'Invite expiring soon',
      body: `The invite for ${invite.email} expires in ${hours} ${hours === 1 ? 'hour' : 'hours'}. Resend it if they still need it.`,
      dedupeKey: `invite-expiring:${invite._id}:${invite.expiresAt.getTime()}`,
    });
    if (note) sent += 1;
  }
  return { sent };
}

// Daily at 08:00: yesterday in one line, for owners who keep the daily summary on.
export async function runDailySummaries(now = new Date()) {
  const businesses = await Business.find({ isLive: true, 'notifications.dailySummary': true });
  let sent = 0;
  for (const business of businesses) {
    const yesterday = dateKey(new Date(now.getTime() - DAY_MS), business.timeZone);
    const day = await summaryForDay(business, yesterday);
    if (!day.issued) continue; // nothing to report
    const wait = day.avgWaitMinutes == null ? '' : `, average wait ${day.avgWaitMinutes} min`;
    const note = await notifyAdmin(business._id, {
      kind: 'daily_summary',
      title: 'Yesterday at a glance',
      body: `${day.issued} tokens, ${day.served} served, ${day.noShows} no-shows${wait}.`,
      dedupeKey: `daily-summary:${yesterday}`,
    });
    if (note) sent += 1;
  }
  return { sent };
}
