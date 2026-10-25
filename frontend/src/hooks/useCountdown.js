import { useEffect, useState } from 'react';

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

// Milliseconds left until `target` (0 when passed or not set).
export function useCountdown(target) {
  const now = useNow(1000);
  return target ? Math.max(0, target - now) : 0;
}
