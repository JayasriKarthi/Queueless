import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { STORE_KEYS } from '../config/constants';

let toastId = 0;

export const useUiStore = create(
  persist(
    (set, get) => ({
      toasts: [],
      theme: 'light',
      sidebarCollapsed: false,
      mobileNavOpen: false,
      paletteOpen: false,
      soundEnabled: false,
      dismissed: { announcement: false, planBanner: {}, recommended: [] },
      setupGuideOpen: true,
      toast: (message, opts = {}) => {
        const id = ++toastId;
        set({ toasts: [...get().toasts, { id, message, tone: opts.tone ?? 'default' }] });
        setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), opts.duration ?? 4000);
      },
      dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
      set: (patch) => set(typeof patch === 'function' ? patch : () => patch),
      dismiss: (key, value = true) => set({ dismissed: { ...get().dismissed, [key]: value } }),
    }),
    {
      name: STORE_KEYS.ui,
      version: 1,
      partialize: (s) => ({ theme: s.theme, sidebarCollapsed: s.sidebarCollapsed, dismissed: s.dismissed, setupGuideOpen: s.setupGuideOpen }),
    },
  ),
);

export const toast = (message, opts) => useUiStore.getState().toast(message, opts);
