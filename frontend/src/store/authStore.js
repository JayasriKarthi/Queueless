import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { initialSeed } from '../data/seed';
import { STORE_KEYS } from '../config/constants';

export const useAuthStore = create(
  persist(
    (set) => ({
      users: initialSeed().users,
      invites: initialSeed().invites,
      session: null, // { userId, businessId, role }
      pinLocks: {}, // { [businessId]: { attempts, lockedUntil } }
      set: (patch) => set(typeof patch === 'function' ? patch : () => patch),
    }),
    { name: STORE_KEYS.auth, version: 1 },
  ),
);

export const useSession = () => useAuthStore((s) => s.session);
export const useCurrentUser = () => useAuthStore((s) => s.users.find((u) => u.id === s.session?.userId) ?? null);
