import { useEffect, useRef, useState } from 'react';

export function useInView(options = { threshold: 0.12 }) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return undefined;
    if (!('IntersectionObserver' in window)) {
      setInView(true);
      return undefined;
    }
    const io = new IntersectionObserver(([entry]) => entry.isIntersecting && setInView(true), options);
    io.observe(el);
    return () => io.disconnect();
  }, [inView, options]);
  return [ref, inView];
}
