import { env } from '../config/env.js';
import { EnterpriseLead } from '../models/EnterpriseLead.js';
import { sendEmail, inBackground } from './notification.service.js';

// "Contact sales": saved first (so no lead is ever lost). Then, in the background so a slow
// email provider never delays the thank-you: a confirmation to the address the person entered,
// and a copy to the sales inbox only when SALES_EMAIL is set.
export async function createLead({ name, email, company, locations, message }) {
  const lead = await EnterpriseLead.create({ name, email, company, locations, message });
  const where = `${locations} ${locations === 1 ? 'location' : 'locations'}`;

  inBackground(() =>
    sendEmail({
      to: email,
      subject: 'We received your request - QueueLess',
      text: [
        `Hi ${name},`,
        '',
        `Thanks for your interest in QueueLess Enterprise for ${company} (${where}).`,
        'Our team will contact you within one working day.',
        '',
        'What you sent us:',
        message || '(no message)',
        '',
        'QueueLess',
      ].join('\n'),
    }),
  );

  if (env.SALES_EMAIL) {
    inBackground(() =>
      sendEmail({
        to: env.SALES_EMAIL,
        subject: `Enterprise lead: ${company} (${where})`,
        text: [`Name: ${name}`, `Email: ${email}`, `Company: ${company}`, `Locations: ${locations}`, '', message || '(no message)'].join('\n'),
      }),
    );
  }
  return lead;
}
