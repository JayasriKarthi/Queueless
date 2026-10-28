import { useCallback, useEffect, useState } from 'react';
import { getPublicPage } from '../lib/fakeBackend';
import { getSocket, joinRoom } from '../lib/socket';

// A business's public page data, kept live: the page follows public:<id> and reloads when the
// waiting counts, opening state, or branding change. `state` is 'loading' | 'ready' | 'missing'.
export function usePublicBusiness(slug) {
  const [state, setState] = useState(slug ? 'loading' : 'missing');
  const [business, setBusiness] = useState(null);

  const load = useCallback(async () => {
    if (!slug) return;
    const res = await getPublicPage(slug);
    if (res.ok) {
      setBusiness(res.business);
      setState('ready');
    } else if (res.status === 404) {
      setBusiness(null);
      setState('missing');
    }
    // Other failures (offline) keep what is on screen; the next event or reconnect retries.
  }, [slug]);

  useEffect(() => {
    if (!slug) return undefined;
    setState('loading');
    load();
    const socket = getSocket();
    let timer;
    const reload = () => {
      clearTimeout(timer);
      timer = setTimeout(load, 250);
    };
    const follow = () => joinRoom('public:join', { slug }); // rooms are forgotten on reconnect
    const onConnect = () => {
      follow();
      reload();
    };
    socket.on('connect', onConnect);
    socket.on('queue:updated', reload);
    socket.on('business:updated', reload);
    follow();
    return () => {
      clearTimeout(timer);
      socket.off('connect', onConnect);
      socket.off('queue:updated', reload);
      socket.off('business:updated', reload);
    };
  }, [slug, load]);

  return { state, business, reload: load };
}
