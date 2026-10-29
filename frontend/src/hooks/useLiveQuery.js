import { useCallback, useEffect, useRef, useState } from 'react';
import { getSocket } from '../lib/socket';

// Anything that changes what owners see: a customer joining or being called, a counter
// pausing, settings, a new notification. All arrive in the business room.
const LIVE_EVENTS = ['token:created', 'token:updated', 'queue:updated', 'resource:updated', 'business:updated', 'notification:new'];

// Loads data with `load()` (which returns { ok, ... }) and loads it again, shortly after, every
// time a live event arrives or the connection comes back. Old answers never overwrite newer ones.
// Returns { data, loading, error, reload }.
export function useLiveQuery(load, deps, { delay = 500, events = LIVE_EVENTS } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const latest = useRef(0);

  const run = useCallback(async () => {
    const id = ++latest.current;
    const res = await load();
    if (id !== latest.current) return; // a newer request has started since
    if (res.ok) {
      setData(res);
      setError(null);
    } else setError(res.error);
    setLoading(false);
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setLoading(true);
    run();
    const socket = getSocket();
    let timer;
    const soon = () => {
      clearTimeout(timer);
      timer = setTimeout(run, delay);
    };
    events.forEach((e) => socket.on(e, soon));
    socket.on('connect', soon);
    return () => {
      clearTimeout(timer);
      events.forEach((e) => socket.off(e, soon));
      socket.off('connect', soon);
    };
  }, [run]); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, loading, error, reload: run };
}
