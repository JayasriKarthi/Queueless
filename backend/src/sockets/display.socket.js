import { z } from 'zod';
import { resolvePublicSlug } from '../services/slug.service.js';
import { hasFeature } from '../utils/constants.js';
import { rooms, reply, refuse, handleJoin, slugSchema, roomLimitReached } from './rooms.js';

// Waiting-room TV displays. A TV joins display:<businessId> by slug, but only when the
// business is live and its plan includes the TV display. The answer tells the TV what to show.
export function registerDisplaySocket(io, socket) {
  // { slug } -> { ok, business: { id, slug, name } }
  socket.on(
    'display:join',
    handleJoin(z.object({ slug: slugSchema }), async ({ slug }, ack) => {
      if (roomLimitReached(socket)) return refuse(ack, 'TOO_MANY_ROOMS', 'Too many rooms on one connection');
      const { business } = await resolvePublicSlug(slug);
      if (!business) return refuse(ack, 'BUSINESS_NOT_FOUND', 'Display not found');
      if (!hasFeature(business.plan, 'tvDisplay')) return refuse(ack, 'PLAN_REQUIRED', 'The TV display is on paid plans');
      if (!business.isLive) return refuse(ack, 'not_live', 'This queue is not open yet');
      socket.join(rooms.display(business._id));
      return reply(ack, { ok: true, business: { id: business.id, slug: business.slug, name: business.name } });
    }),
  );
}
