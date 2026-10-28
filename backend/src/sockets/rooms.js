import { z } from 'zod';

// Room names. They use ids, not slugs: if an owner renames their link, screens that are
// already open stay in the same room. Clients still join by slug; the server looks it up.
export const rooms = {
  business: (businessId) => `business:${businessId}`, // owner and staff screens
  display: (businessId) => `display:${businessId}`, // TV displays
  public: (businessId) => `public:${businessId}`, // join pages
  token: (tokenId) => `token:${tokenId}`, // one customer's phone
};

// A guest socket may follow a handful of rooms, which is plenty for a page or a TV,
// and stops one connection from subscribing to everything.
export const MAX_GUEST_ROOMS = 10;

// Replies to a client's join request: { ok: true, ... } or { ok: false, error: { code, message } }.
// Clients that did not ask for a reply (no callback) are simply ignored.
export const reply = (ack, body) => {
  if (typeof ack === 'function') ack(body);
};
export const refuse = (ack, code, message) => reply(ack, { ok: false, error: { code, message } });

// Runs a join handler with its payload checked, never letting an error escape to crash the socket.
export const handleJoin = (schema, handler) => async (payload, ack) => {
  const parsed = schema.safeParse(payload ?? {});
  if (!parsed.success) return refuse(ack, 'VALIDATION_ERROR', 'Invalid join request');
  try {
    return await handler(parsed.data, ack);
  } catch (err) {
    console.error('Socket join failed', err);
    return refuse(ack, 'INTERNAL_ERROR', 'Something went wrong');
  }
};

export const slugSchema = z.string().trim().min(1).max(60);
export const idSchema = z.string().regex(/^[a-f0-9]{24}$/);

// Guests only; owners and staff are placed in their business room automatically.
export function roomLimitReached(socket) {
  return [...socket.rooms].filter((r) => r !== socket.id).length >= MAX_GUEST_ROOMS;
}
