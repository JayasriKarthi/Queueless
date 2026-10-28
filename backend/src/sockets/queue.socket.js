// Live queue events. Services call emitQueueEvent after a change is saved.
// Phase 10 connects this to Socket.IO rooms (business, display, public, and token rooms).
// Until then, events are simply not sent anywhere.
// eslint-disable-next-line no-unused-vars
export function emitQueueEvent(event, business, payload) {}
