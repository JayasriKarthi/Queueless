import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { initialSeed } from '../data/seed';
import { STORE_KEYS } from '../config/constants';

export const useQueueStore = create(
  persist(
    (set) => ({
      tokens: initialSeed().tokens,
      set: (patch) => set(typeof patch === 'function' ? patch : () => patch),
    }),
    { name: STORE_KEYS.queue, version: 1 },
  ),
);
