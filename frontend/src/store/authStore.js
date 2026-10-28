import { create } from 'zustand';

// Who is logged in, filled from the API (nothing is saved in the browser: on reload the
// session comes back through the refresh cookie). `status` is 'loading' until that check ends.
// `users` and `invites` are this business's staff list, loaded by the Staff page.
export const useAuthStore = create((set) => ({
  status: 'loading', // 'loading' | 'ready'
  session: null, // { userId, businessId, role }
  user: null,
  users: [],
  invites: [],
  pinLocks: {},
  set: (patch) => set(typeof patch === 'function' ? patch : () => patch),
}));

export const useSession = () => useAuthStore((s) => s.session);
export const useCurrentUser = () => useAuthStore((s) => s.user);
