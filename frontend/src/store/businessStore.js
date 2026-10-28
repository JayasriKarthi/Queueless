import { create } from 'zustand';

// A cache of server data for the logged-in business, in the shapes the pages read:
// `businesses` holds that one business, with its services and resources inside it.
export const useBusinessStore = create((set) => ({
  businesses: [],
  invoices: [],
  activity: [],
  notifications: [],
  analytics: {},
  set: (patch) => set(typeof patch === 'function' ? patch : () => patch),
}));

export const useBusinessById = (id) => useBusinessStore((s) => s.businesses.find((b) => b.id === id) ?? null);
