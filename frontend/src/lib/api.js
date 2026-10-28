// The one place that talks to the QueueLess API. Every call returns the same shapes the
// pages already handle: { ok: true, ...data } or { ok: false, error, code, details, status }.
// It never throws for a failed request, so pages keep their "if (!res.ok)" checks.

export const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

// The access token lives in memory only (never localStorage, so page scripts and
// extensions cannot read it from storage). The refresh token is an HTTP-only cookie.
let accessToken = null;
let onSessionLost = () => {};
export const setAccessToken = (token) => {
  accessToken = token;
};
export const getAccessToken = () => accessToken;
export const whenSessionLost = (fn) => {
  onSessionLost = fn;
};

// Logos are served by the API ("/uploads/logos/..."), so they need its address in front.
export const assetUrl = (path) => (!path ? '' : /^(https?:|data:|blob:)/.test(path) ? path : `${API_URL}${path}`);

// The server sends dates as ISO text; the pages compare and format milliseconds.
const DATE_KEY = /(At|Until)$|^date$/;
export function revive(value, key = '') {
  if (Array.isArray(value)) return value.map((v) => revive(v));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, revive(v, k)]));
  if (typeof value === 'string' && DATE_KEY.test(key)) {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? value : ms;
  }
  return value;
}

const failure = (status, error = {}) => ({
  ok: false,
  status,
  code: error.code ?? 'ERROR',
  error: error.message ?? 'Something went wrong. Please try again.',
  details: error.details,
});

// One refresh at a time, shared by every request that hit an expired token at once.
let refreshing = null;
export function refreshSession() {
  refreshing ??= fetch(`${API_URL}/api/auth/refresh`, { method: 'POST', credentials: 'include' })
    .then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setAccessToken(null);
        return failure(res.status, data.error);
      }
      setAccessToken(data.accessToken);
      return revive(data);
    })
    .catch(() => failure(0, { code: 'NETWORK', message: 'Could not reach the server. Check your connection.' }))
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

// request('POST', '/api/admin/services', { body }) or { form } for file uploads, { query } for
// ?a=b, { raw: true } to get the Response itself (CSV and PNG downloads).
export async function request(method, path, { body, form, query, raw = false, retry = true } = {}) {
  const qs = query ? `?${new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString()}` : '';
  const headers = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(`${API_URL}${path}${qs}`, {
      method,
      headers,
      credentials: 'include',
      body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
    });
  } catch {
    return failure(0, { code: 'NETWORK', message: 'Could not reach the server. Check your connection.' });
  }

  // An expired access token: refresh once, then repeat the request.
  if (res.status === 401 && retry && !path.startsWith('/api/auth/')) {
    const refreshed = await refreshSession();
    if (refreshed.ok) return request(method, path, { body, form, query, raw, retry: false });
    onSessionLost();
  }

  if (raw) return res.ok ? { ok: true, response: res } : failure(res.status, (await res.json().catch(() => ({}))).error);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) return failure(res.status, data.error);
  return revive(data);
}

export const api = {
  get: (path, options) => request('GET', path, options),
  post: (path, body, options) => request('POST', path, { ...options, body }),
  patch: (path, body, options) => request('PATCH', path, { ...options, body }),
  del: (path, body, options) => request('DELETE', path, { ...options, body }),
};
