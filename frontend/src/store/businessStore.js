import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { initialSeed } from '../data/seed';
import { STORE_KEYS } from '../config/constants';

export const useBusinessStore = create(
  persist(
    (set) => ({
      businesses: initialSeed().businesses,
      invoices: initialSeed().invoices,
      activity: initialSeed().activity,
      notifications: initialSeed().notifications,
      analytics: initialSeed().analytics,
      set: (patch) => set(typeof patch === 'function' ? patch : () => patch),
    }),
    { name: STORE_KEYS.business, version: 1 },
  ),
);

export const useBusinessById = (id) => useBusinessStore((s) => s.businesses.find((b) => b.id === id) ?? null);
