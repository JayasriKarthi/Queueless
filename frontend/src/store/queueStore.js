import { create } from 'zustand';

// Today's queue for the logged-in business, from the staff console endpoint, kept up to date by
// live events. `lines`: one per resource this person may serve. `tokens`: those lines' current
// and waiting tokens, which admin pages count from.
export const useQueueStore = create((set) => ({
  lines: [],
  tokens: [],
  servingNow: 0,
  loaded: false,
  set: (patch) => set(typeof patch === 'function' ? patch : () => patch),
}));
