import { useMemo } from 'react';
import { toast } from '../store/uiStore';
import * as api from '../lib/fakeBackend';

// Queue actions with consistent toasts, shared by the staff console and admin queues.
export function useQueueActions(business) {
  return useMemo(() => ({
    callNext: (resourceId) => {
      const res = api.callNext(business.id, resourceId);
      if (res.token) toast(`Called ${res.token.code}`);
      else toast('No one is waiting in this line');
      return res.token;
    },
    callThis: (token, resourceId) => {
      api.callSpecific(token.id, resourceId);
      toast(`Called ${token.code}`);
    },
    arrived: (token) => api.startServing(token.id),
    done: (token) => {
      api.markDone(token.id);
      toast(`${token.code} marked done`);
    },
    noShow: (token) => {
      api.markNoShow(token.id);
      toast(`${token.code} marked as no-show`);
    },
    recall: (token) => {
      api.recall(token.id);
      toast(`Recalled ${token.code}`);
    },
    skip: (token) => {
      api.skipToEnd(token.id);
      toast(`${token.code} moved to the end`);
    },
    remove: (token) => {
      api.removeToken(token.id);
      toast(`${token.code} removed from the line`);
    },
    togglePause: (resource) => {
      api.setResourcePaused(business.id, resource.id, !resource.isPaused);
      toast(resource.isPaused ? `${resource.name} resumed` : `${resource.name} paused`);
    },
  }), [business.id]);
}
