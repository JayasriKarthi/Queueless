import { useCallback, useState } from 'react';

const key = (slug) => `ql-guest-token:${slug}`;

// Remembers the customer's token id for a business on this device.
export function useGuestToken(slug) {
  const [tokenId, setState] = useState(() => {
    try {
      return localStorage.getItem(key(slug));
    } catch {
      return null;
    }
  });
  const setTokenId = useCallback(
    (id) => {
      try {
        if (id) localStorage.setItem(key(slug), id);
        else localStorage.removeItem(key(slug));
      } catch {
        /* storage unavailable */
      }
      setState(id);
    },
    [slug],
  );
  return [tokenId, setTokenId];
}
