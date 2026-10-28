import { env } from '../config/env.js';

// Emails sent outside production, newest last. Tests read this; it is never filled in production.
export const outbox = [];

// Phase 14 connects a real email provider (Resend, SES, or Nodemailer) here.
// Until then, development prints the email to the server console instead of sending it.
export async function sendEmail({ to, subject, text }) {
  if (env.NODE_ENV !== 'production') {
    outbox.push({ to, subject, text, at: new Date() });
    if (env.NODE_ENV === 'development') console.log(`\n[email to ${to}] ${subject}\n${text}\n`);
    return;
  }
  // Never log email contents in production: they can contain single-use links.
  console.warn(`Email provider not configured; "${subject}" was not sent.`);
}
