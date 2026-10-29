import { useCallback, useEffect, useState } from 'react';
import { getDisplay } from '../lib/fakeBackend';
import { getSocket, joinRoom } from '../lib/socket';

// The TV's data, kept live through display:<id>. `lastCall` is the most recent token:called
// ({ code, resource, at }), which makes the screen flash and chime.
// `state`: 'loading' | 'ready' | 'locked' (plan without the TV display) | 'missing'.
export function useDisplay(slug) {
  const [state, setState] = useState('loading');
  const [display, setDisplay] = useState(null);
  const [lastCall, setLastCall] = useState(null);

  const load = useCallback(async () => {
    const res = await getDisplay(slug);
    if (res.ok) {
      setDisplay(res.display);
      setState('ready');
    } else if (res.status === 402) setState('locked');
    else if (res.status === 404) setState('missing');
    // Anything else (offline): keep the last picture; the next event or check retries.
  }, [slug]);

  useEffect(() => {
    setState('loading');
    load();
    const socket = getSocket();
    let timer;
    const reload = () => {
      clearTimeout(timer);
      timer = setTimeout(load, 200);
    };
    // The server only lets a TV follow a live business on a plan with the TV display,
    // so the join is repeated on reconnect and with every slow check (after going live).
    const follow = () => joinRoom('display:join', { slug });
    const onCalled = (call) => {
      setLastCall({ ...call, at: Date.now() });
      reload();
    };
    const onConnect = () => {
      follow();
      reload();
    };
    const events = ['queue:updated', 'business:updated', 'resource:updated'];
    socket.on('connect', onConnect);
    socket.on('token:called', onCalled);
    events.forEach((e) => socket.on(e, reload));
    follow();
    const poll = setInterval(() => {
      follow();
      load();
    }, 60000);
    return () => {
      clearTimeout(timer);
      clearInterval(poll);
      socket.off('connect', onConnect);
      socket.off('token:called', onCalled);
      events.forEach((e) => socket.off(e, reload));
    };
  }, [slug, load]);

  return { state, display, lastCall };
}
