import { env } from '../config/env.js';
import { EnterpriseLead } from '../models/EnterpriseLead.js';
import { sendEmail, inBackground } from './notification.service.js';

// "Contact sales": saved first (so no lead is ever lost), then emailed to the sales inbox
// in the background, so a slow email provider never delays the thank-you.
export async function createLead({ name, email, company, locations, message }) {
  const lead = await EnterpriseLead.create({ name, email, company, locations, message });
  inBackground(() =>
    sendEmail({
      to: env.SALES_EMAIL,
      subject: `Enterprise lead: ${company} (${locations} ${locations === 1 ? 'location' : 'locations'})`,
      text: [`Name: ${name}`, `Email: ${email}`, `Company: ${company}`, `Locations: ${locations}`, '', message || '(no message)'].join('\n'),
    }),
  );
  return lead;
}
