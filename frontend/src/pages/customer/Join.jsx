import { useMemo, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import { Hourglass, DoorClosed, Ban, Users, Ticket } from 'lucide-react';
import { useQueueStore } from '../../store/queueStore';
import { useGuestToken } from '../../hooks/useGuestToken';
import { joinQueue, dailyLimit } from '../../lib/fakeBackend';
import { businessWait, resourceWait, isActive } from '../../lib/queueMath';
import { hasFeature } from '../../config/plans';
import { startOfDay, formatMinutes } from '../../lib/formatters';
import { toast } from '../../store/uiStore';
import BusinessHeader from '../../components/customer/BusinessHeader';
import ResourcePicker from '../../components/customer/ResourcePicker';
import JoinForm from '../../components/customer/JoinForm';
import { customerCard } from '../../components/customer/styles';

function Notice({ icon: Icon, title, children }) {
  return (
    <div className={`${customerCard} mt-6 text-center`} role="status">
      <Icon className="mx-auto h-10 w-10 text-[var(--brand)]" aria-hidden="true" />
      <h2 className="mt-3 text-xl font-medium">{title}</h2>
      <p className="mt-2 text-black/60 dark:text-white/60">{children}</p>
    </div>
  );
}

export default function Join() {
  const { business } = useOutletContext();
  const tokens = useQueueStore((s) => s.tokens);
  const navigate = useNavigate();
  const [guestTokenId, setGuestTokenId] = useGuestToken(business.slug);
  const mode = business.settings.queueMode;
  const services = business.services.filter((s) => s.isActive);
  const resources = business.resources.filter((r) => r.isActive);
  const [choice, setChoice] = useState(null);

  const mine = useMemo(() => tokens.filter((t) => t.businessId === business.id), [tokens, business.id]);
  const wait = businessWait(business, mine);
  const guestToken = mine.find((t) => t.id === guestTokenId && isActive(t));
  const todayCount = mine.filter((t) => t.createdAt >= startOfDay()).length;
  const full = todayCount >= dailyLimit(business);

  const options = useMemo(() => {
    if (mode === 'per_resource') {
      const list = resources.map((r) => {
        const w = resourceWait(business, mine, r);
        return { id: r.id, title: r.name, subtitle: business.services.filter((s) => r.serviceIds.includes(s.id)).map((s) => s.name).join(', '), tag: r.isPaused ? 'Paused' : w.waiting ? `${w.waiting} waiting · ~${formatMinutes(w.minutes)}` : 'No wait', disabled: r.isPaused };
      });
      if (business.settings.allowAnyAvailable && list.length > 1) list.unshift({ id: 'any', any: true, title: 'Any available', subtitle: `The next free ${business.labels.resource.toLowerCase()}`, tag: 'Fastest' });
      return list;
    }
    if (mode === 'per_service' || services.length > 1) {
      return services.map((s) => {
        const waiting = mine.filter((t) => t.status === 'WAITING' && t.serviceId === s.id).length;
        return { id: s.id, title: s.name, subtitle: `About ${s.avgMinutes} min each`, tag: waiting ? `${waiting} waiting` : 'No wait' };
      });
    }
    return [];
  }, [mode, resources, services, business, mine]);

  const selected = options.length ? choice ?? options.find((o) => !o.disabled)?.id : null;

  const submit = async (values) => {
    await new Promise((r) => setTimeout(r, 600));
    const { priority, ...customer } = values;
    const res = joinQueue(business.id, {
      serviceId: mode === 'per_resource' ? null : selected ?? services[0]?.id,
      resourceId: mode === 'per_resource' ? selected : null,
      customer,
      priority,
    });
    if (!res.ok) {
      toast(res.error === 'limit' ? 'Today\'s line just filled up.' : res.error === 'closed' ? 'The queue just closed.' : 'Could not join right now.', { tone: 'critical' });
      throw new Error(res.error);
    }
    if (res.existing) toast('You already have a token, here it is');
    setGuestTokenId(res.token.id);
    navigate(`/${business.slug}/token/${res.token.id}`);
  };

  const blocked = !business.isLive ? 'not_live' : !business.isOpen ? 'closed' : full ? 'full' : null;

  return (
    <div>
      <BusinessHeader business={business} />
      {business.isLive && (
        <p className="mt-4 flex items-center gap-2 rounded-2xl bg-[var(--brand-soft)] px-4 py-3 text-[15px]" aria-live="polite">
          <Users className="h-5 w-5 text-[var(--brand)]" aria-hidden="true" />
          {wait.waiting === 0 ? 'No one is waiting right now.' : <span><strong className="font-medium">{wait.waiting} {wait.waiting === 1 ? 'person' : 'people'} waiting</strong>, about {formatMinutes(wait.minutes)}</span>}
        </p>
      )}

      {guestToken && (
        <Link to={`/${business.slug}/token/${guestToken.id}`} className="mt-4 flex min-h-[44px] items-center gap-3 rounded-2xl bg-[#1A1A1A] px-4 py-3 text-white dark:bg-white dark:text-[#1A1A1A]">
          <Ticket className="h-5 w-5" aria-hidden="true" />
          <span className="flex-1">You already have token <strong>{guestToken.code}</strong></span>
          <span className="text-sm underline">View</span>
        </Link>
      )}

      {blocked === 'not_live' && <Notice icon={Hourglass} title="This queue is not open yet">{business.name} is still setting up. Please check back soon or ask at the front desk.</Notice>}
      {blocked === 'closed' && <Notice icon={DoorClosed} title="Closed">The line is closed for now. People already waiting will still be served.</Notice>}
      {blocked === 'full' && <Notice icon={Ban} title="Today's line is full">We have reached today's token limit. Please visit the front desk or try again tomorrow.</Notice>}

      {!blocked && (
        <div className={`${customerCard} mt-5 space-y-5`}>
          {options.length > 0 && (
            <ResourcePicker label={mode === 'per_resource' ? `Choose a ${business.labels.resource.toLowerCase()}` : `Choose a ${business.labels.service.toLowerCase()}`} options={options} value={selected} onChange={setChoice} />
          )}
          <JoinForm fields={business.settings.customerFields} allowPriority={business.settings.allowPriority && hasFeature(business.plan, 'priorityQueues')} onSubmit={(v) => submit(v).catch(() => {})} disabled={options.length > 0 && !selected} />
        </div>
      )}
    </div>
  );
}
