import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { Business } from '../models/Business.js';
import { Token } from '../models/Token.js';
import { Service } from '../models/Service.js';
import { Resource } from '../models/Resource.js';
import { Notification } from '../models/Notification.js';
import { ALMOST_THRESHOLD, TOKEN_STATUS, hasFeature, planLimit } from '../utils/constants.js';
import { dateKey } from '../utils/tokenNumber.js';
import { QUEUE_ORDER, isPinned } from './queue.service.js';
import { emitTo } from '../sockets/index.js';
import { emitNotification } from '../sockets/queue.socket.js';
import { rooms } from '../sockets/rooms.js';

const LONG_LINE = 8; // people waiting in one line before the owner is told
const SMS_LOW_SHARE = 0.8; // warn once 80% of the month's SMS are used

/* ================================================================
   Message adapters. Swap a provider in here; nothing else changes.
   Every send is logged (numbers masked). Outside production, messages
   are kept in memory instead of sent, so tests and development can see them.
   ================================================================ */

export const outbox = []; // emails
export const smsOutbox = []; // text messages

const maskPhone = (phone = '') => `${phone.slice(0, 2)}xxxxx${phone.slice(-3)}`;
const logSend = (channel, to, result) => {
  if (env.NODE_ENV !== 'test') console.info(`[${channel}] ${result}: ${to}`);
};

// Email through SMTP (Gmail with an app password, or any provider's SMTP). Tests never send:
// they read `outbox`. Without SMTP settings, development prints each email in the terminal.
const smtpReady = env.NODE_ENV !== 'test' && Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
const mailer = smtpReady
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465, // 465 = encrypted from the start; 587 upgrades with STARTTLS
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    })
  : null;
// Gmail only sends as the account that logs in, so the default sender becomes that address.
const sender = smtpReady && env.EMAIL_FROM.includes('@queueless.app') ? `QueueLess <${env.SMTP_USER}>` : env.EMAIL_FROM;

// Called once at start-up (server.js): says in the terminal whether real email will work.
export async function checkEmail() {
  if (!mailer) {
    if (env.NODE_ENV === 'development') console.log('Email: not set up (SMTP_* in .env); emails are printed here instead');
    return false;
  }
  try {
    await mailer.verify();
    console.log(`Email: sending through ${env.SMTP_HOST} as ${env.SMTP_USER}`);
    return true;
  } catch (err) {
    console.error(`Email: ${env.SMTP_HOST} refused the login (${err.message}). Check SMTP_USER and SMTP_PASS.`);
    return false;
  }
}

// Returns whether the email went out. A failure is logged, never thrown: the invite or reset
// itself is already saved, and the owner can resend.
export async function sendEmail({ to, subject, text }) {
  if (env.NODE_ENV === 'test') {
    outbox.push({ to, subject, text, at: new Date() });
    return true;
  }
  if (!mailer) {
    if (env.NODE_ENV === 'development') {
      outbox.push({ to, subject, text, at: new Date() });
      console.log(`\n[email to ${to}] ${subject}\n${text}\n`);
      return true;
    }
    logSend('email', to, 'not sent, no provider configured');
    return false;
  }
  try {
    await mailer.sendMail({ from: sender, to, subject, text });
    logSend('email', to, 'sent'); // the address only: emails can hold single-use links
    return true;
  } catch (err) {
    console.error(`Email to ${to} failed: ${err.message}`);
    return false;
  }
}

// SMS to an Indian mobile number. Returns whether the provider accepted it.
// To go live: call MSG91 or Twilio here using env.SMS_PROVIDER_KEY.
export async function sendSms({ to, text }) {
  if (env.NODE_ENV !== 'production') {
    smsOutbox.push({ to, text, at: new Date() });
    logSend('sms', maskPhone(to), 'kept in development outbox');
    return true;
  }
  logSend('sms', maskPhone(to), env.SMS_PROVIDER_KEY ? 'not sent, provider adapter not written yet' : 'not sent, no provider configured');
  return false;
}

/* ================================================================
   Background work. Notifications never delay or fail the request that
   caused them; failures are logged. Tests wait with notificationsIdle().
   ================================================================ */

const pending = new Set();

export function inBackground(task) {
  const run = Promise.resolve()
    .then(task)
    .catch((err) => console.error('Background task failed', err))
    .finally(() => pending.delete(run));
  pending.add(run);
}

export async function notificationsIdle() {
  while (pending.size) await Promise.all([...pending]);
}

/* ======================================================== admin bell */

// Stores a notification and pushes it to the owner's open screens. With a dedupeKey, the
// same notification is only ever created once (repeats are ignored).
export async function notifyAdmin(businessId, { kind, title, body, dedupeKey }) {
  let notification;
  try {
    notification = await Notification.create({ businessId, kind, title, body, dedupeKey });
  } catch (err) {
    if (err.code === 11000) return null; // already told
    throw err;
  }
  emitNotification(businessId, notification.toJSON());
  return notification;
}

export async function listNotifications(business, limit = 30) {
  const [items, unread] = await Promise.all([
    Notification.find({ businessId: business._id }).sort({ createdAt: -1 }).limit(limit),
    Notification.countDocuments({ businessId: business._id, read: false }),
  ]);
  return { notifications: items, unread };
}

export async function markAllRead(business) {
  const { modifiedCount } = await Notification.updateMany({ businessId: business._id, read: false }, { $set: { read: true } });
  return modifiedCount;
}

/* ============================================================== SMS */

const monthKey = (business) => dateKey(new Date(), business.timeZone).slice(0, 7);

// Takes one SMS credit, atomically, only if SMS alerts are on, the plan includes them, and
// credits are left. Tells the owner (once a month) when credits run low or run out.
async function useSmsCredit(business) {
  if (!business.notifications?.almostSms || !hasFeature(business, 'smsAlerts')) return false;
  const limit = planLimit(business.plan, 'smsPerMonth');
  const updated = await Business.findOneAndUpdate(
    { _id: business._id, ...(limit !== Infinity && { smsUsed: { $lt: limit } }) },
    { $inc: { smsUsed: 1 } },
    { returnDocument: 'after' },
  ).select('smsUsed');

  if (!updated) {
    await notifyAdmin(business._id, {
      kind: 'sms_used_up',
      title: 'SMS credits used up',
      body: `All ${limit} SMS for this month are used. Customers still see alerts on their screens. Upgrade for more SMS.`,
      dedupeKey: `sms-used-up:${monthKey(business)}`,
    });
    return false;
  }
  if (limit !== Infinity && updated.smsUsed >= Math.ceil(limit * SMS_LOW_SHARE)) {
    await notifyAdmin(business._id, {
      kind: 'sms_low',
      title: 'SMS credits running low',
      body: `You have used ${updated.smsUsed} of ${limit} SMS this month.`,
      dedupeKey: `sms-low:${monthKey(business)}`,
    });
  }
  return true;
}

// Sends one SMS to a customer if allowed; the credit is given back if sending fails.
async function textCustomer(business, token, text) {
  if (!token.customer?.phone || !(await useSmsCredit(business))) return false;
  const sent = await sendSms({ to: token.customer.phone, text }).catch(() => false);
  if (!sent) await Business.updateOne({ _id: business._id, smsUsed: { $gt: 0 } }, { $inc: { smsUsed: -1 } });
  return sent;
}

/* ======================================================= customers */

// "Almost your turn": when 3 or fewer people are ahead, once per token. Always to the token's
// own page (banner and vibration); also by SMS when the business has paid SMS alerts on.
export async function checkAlmostTurn(business, queueKeys) {
  for (const queueKey of queueKeys) {
    const front = await Token.find({ businessId: business._id, status: TOKEN_STATUS.WAITING, queueKey })
      .sort(QUEUE_ORDER)
      .limit(ALMOST_THRESHOLD + 1)
      .select('code customer alertedAlmostAt');
    for (const [ahead, token] of front.entries()) {
      if (token.alertedAlmostAt) continue;
      // Claimed atomically, so two line changes at once can never alert the same person twice.
      const claimed = await Token.findOneAndUpdate({ _id: token._id, status: TOKEN_STATUS.WAITING, alertedAlmostAt: null }, { $set: { alertedAlmostAt: new Date() } });
      if (!claimed) continue;
      emitTo(rooms.token(token._id), 'token:almost', { code: token.code, ahead });
      const text = ahead === 0
        ? `${business.name}: you are next (token ${token.code}). Please head back now.`
        : `${business.name}: token ${token.code}, ${ahead} ${ahead === 1 ? 'person' : 'people'} ahead of you. Please head back.`;
      await textCustomer(business, token, text);
    }
  }
}

// "It is your turn". The page alert is the token:called live event; this adds the SMS.
export function notifyCalled(business, token, resource) {
  return textCustomer(business, token, `${business.name}: it is your turn (token ${token.code}). Please go to ${resource.name}.`);
}

// A human name for a line, for owner notifications.
async function lineName(business, queueKey) {
  if (queueKey === 'shared') return 'Your line';
  if (queueKey === 'res:any') return 'The "any available" line';
  const id = queueKey.slice(4);
  const doc = isPinned(queueKey) ? await Resource.findOne({ _id: id, businessId: business._id }).select('name') : await Service.findOne({ _id: id, businessId: business._id }).select('name');
  return doc?.name ?? 'A line';
}

// After a customer joins: no "almost" alert for someone who is already near the front (they
// are looking at the page), and a heads-up to the owner when a line gets long (once a day).
export async function onTokenJoined(business, token, ahead) {
  if (ahead <= ALMOST_THRESHOLD) {
    await Token.updateOne({ _id: token._id, alertedAlmostAt: null }, { $set: { alertedAlmostAt: new Date() } });
  }
  const waiting = await Token.countDocuments({ businessId: business._id, status: TOKEN_STATUS.WAITING, queueKey: token.queueKey });
  if (waiting >= LONG_LINE) {
    await notifyAdmin(business._id, {
      kind: 'long_line',
      title: 'Line is getting long',
      body: `${await lineName(business, token.queueKey)} has ${waiting} people waiting.`,
      dedupeKey: `long-line:${token.queueKey}:${token.day}`,
    });
  }
}
