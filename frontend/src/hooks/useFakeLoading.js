import { useEffect, useState } from 'react';

// Short skeleton phase so screens behave like they would with a real API.
export function useFakeLoading(ms = 350) {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const id = setTimeout(() => setLoading(false), ms);
    return () => clearTimeout(id);
  }, [ms]);
  return loading;
}
