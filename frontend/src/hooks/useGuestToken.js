import { useCallback, useState } from 'react';

const key = (slug) => `ql-guest-token:${slug}`;
const secretKey = (tokenId) => `ql-guest-secret:${tokenId}`;

// The secret the server gave this phone when it took the token. Only this phone has it, so only
// this phone can follow the token live, leave the line, or rate the visit.
export function getGuestSecret(tokenId) {
  try {
    return localStorage.getItem(secretKey(tokenId));
  } catch {
    return null;
  }
}

// Remembers the customer's token id for a business on this device (and its secret).
export function useGuestToken(slug) {
  const [tokenId, setState] = useState(() => {
    try {
      return localStorage.getItem(key(slug));
    } catch {
      return null;
    }
  });
  const setTokenId = useCallback(
    (id, secret) => {
      try {
        if (id) localStorage.setItem(key(slug), id);
        else localStorage.removeItem(key(slug));
        if (id && secret) localStorage.setItem(secretKey(id), secret);
      } catch {
        /* storage unavailable */
      }
      setState(id);
    },
    [slug],
  );
  return [tokenId, setTokenId];
}
