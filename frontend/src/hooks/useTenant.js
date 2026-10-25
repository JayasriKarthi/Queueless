import { useMemo } from 'react';
import { useAuthStore } from '../store/authStore';
import { useBusinessStore } from '../store/businessStore';
import { useQueueStore } from '../store/queueStore';
import { forTenant, computeUsage } from '../lib/fakeBackend';

// The logged-in user's business. Every admin and staff read goes through here.
export function useTenant() {
  const session = useAuthStore((s) => s.session);
  const users = useAuthStore((s) => s.users);
  const businesses = useBusinessStore((s) => s.businesses);
  return useMemo(() => {
    const user = users.find((u) => u.id === session?.userId) ?? null;
    const business = session ? businesses.find((b) => b.id === session.businessId) ?? null : null;
    return { session, user, business };
  }, [session, users, businesses]);
}

export function useTenantTokens() {
  const tokens = useQueueStore((s) => s.tokens);
  const businessId = useAuthStore((s) => s.session?.businessId);
  return useMemo(() => forTenant(tokens, businessId), [tokens, businessId]);
}

export function useTenantCollection(store, key) {
  const items = store((s) => s[key]);
  const businessId = useAuthStore((s) => s.session?.businessId);
  return useMemo(() => forTenant(items, businessId), [items, businessId]);
}

export function useUsage(business) {
  const tokens = useQueueStore((s) => s.tokens);
  const users = useAuthStore((s) => s.users);
  const invites = useAuthStore((s) => s.invites);
  return useMemo(() => computeUsage(business, { tokens, users, invites }), [business, tokens, users, invites]);
}
