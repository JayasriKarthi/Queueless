import { io } from 'socket.io-client';
import { API_URL, getAccessToken } from './api';

// One live connection per tab. Owners and staff connect with their access token and the
// server puts them in their business room. Join pages, token pages, and TVs connect without
// one and ask for their room (public:join, token:join, display:join).

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(API_URL || undefined, {
      withCredentials: true,
      autoConnect: false,
      // A function, so every reconnect sends the newest token (they last 15 minutes).
      auth: (cb) => cb(getAccessToken() ? { token: getAccessToken() } : {}),
    });
  }
  return socket;
}

export function connectSocket() {
  const s = getSocket();
  if (s.connected) s.disconnect(); // the login changed: reconnect with the new token
  s.connect();
  return s;
}

export function disconnectSocket() {
  socket?.disconnect();
}

// Asks to follow a room; resolves with the server's answer ({ ok, ... }).
export function joinRoom(event, payload) {
  const s = getSocket();
  if (!s.connected && !s.active) s.connect();
  return new Promise((resolve) => {
    s.timeout(8000).emit(event, payload, (err, reply) => resolve(err ? { ok: false, error: 'No answer from the server' } : reply));
  });
}
