import { seedBusinesses } from './businesses';
import { seedUsers } from './users';
import { seedInvites } from './invites';
import { seedTokens } from './tokens';
import { seedInvoices } from './invoices';
import { seedActivity, seedNotifications } from './activity';
import { seedAnalytics } from './analytics';

// Builds a fresh copy of every demo collection, with timestamps relative to now.
export function buildSeed(now = Date.now()) {
  const businesses = seedBusinesses(now);
  return {
    businesses,
    users: seedUsers(now),
    invites: seedInvites(now),
    tokens: seedTokens(businesses, now),
    invoices: seedInvoices(now),
    activity: seedActivity(now),
    notifications: seedNotifications(now),
    analytics: seedAnalytics(businesses, now),
  };
}

let cached;
export const initialSeed = () => (cached ??= buildSeed());
