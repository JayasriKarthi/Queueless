import { useMemo } from 'react';
import { toast } from '../store/uiStore';
import * as api from '../lib/fakeBackend';

// Queue actions with consistent toasts, shared by the staff console and admin queues.
// Each one waits for the server; a refused action (already called by someone else, ...) shows why.
const done = (res, message) => {
  if (!res.ok) {
    toast(res.error, { tone: 'critical' });
    return false;
  }
  if (message) toast(message);
  return true;
};

export function useQueueActions(business) {
  return useMemo(() => ({
    callNext: async (resourceId) => {
      const res = await api.callNext(business.id, resourceId);
      if (!res.ok) return done(res);
      toast(res.token ? `Called ${res.token.code}` : res.message ?? 'No one is waiting in this line');
      return res.token;
    },
    callThis: async (token, resourceId) => done(await api.callSpecific(token.id, resourceId), `Called ${token.code}`),
    arrived: async (token) => done(await api.startServing(token.id)),
    done: async (token) => done(await api.markDone(token.id), `${token.code} marked done`),
    noShow: async (token) => done(await api.markNoShow(token.id), `${token.code} marked as no-show`),
    recall: async (token) => done(await api.recall(token.id), `Recalled ${token.code}`),
    skip: async (token) => done(await api.skipToEnd(token.id), `${token.code} moved to the end`),
    remove: async (token) => done(await api.removeToken(token.id), `${token.code} removed from the line`),
    togglePause: async (resource) =>
      done(await api.setResourcePaused(business.id, resource.id, !resource.isPaused), resource.isPaused ? `${resource.name} resumed` : `${resource.name} paused`),
  }), [business.id]);
}
