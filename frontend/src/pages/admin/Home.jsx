import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { X, Lock, ArrowRight, PhoneCall, UserPlus, Settings2, Star, CreditCard, LogIn } from 'lucide-react';
import { useTenant, useTenantTokens, useTenantCollection } from '../../hooks/useTenant';
import { useBusinessStore } from '../../store/businessStore';
import { useUiStore } from '../../store/uiStore';
import { useFakeLoading } from '../../hooks/useFakeLoading';
import { greeting, timeAgo } from '../../lib/formatters';
import { hourlySeries } from '../../lib/analytics';
import { waitingFor, currentFor } from '../../lib/queueMath';
import { hasFeature } from '../../config/plans';
import SetupGuide from '../../components/admin/SetupGuide';
import TodayCard from '../../components/admin/TodayCard';
import { BarChartBox } from '../../components/admin/Charts';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Banner from '../../components/ui/Banner';
import EmptyState from '../../components/ui/EmptyState';
import { SkeletonPage } from '../../components/ui/Skeleton';

const ACTIVITY_ICONS = { call: PhoneCall, join: UserPlus, settings: Settings2, rating: Star, billing: CreditCard, invite: UserPlus, staff: LogIn };

function QueueNow({ business, tokens }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {business.resources.filter((r) => r.isActive).map((r) => {
        const current = currentFor(tokens, business.id, r.id);
        const waiting = waitingFor(business, tokens, r.id).length;
        return (
          <div key={r.id} className="ql-card p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="truncate text-[13px] font-medium">{r.name}</p>
              {r.isPaused ? <Badge tone="attention">Paused</Badge> : <Badge tone={waiting > 3 ? 'attention' : 'info'} dot>{waiting} waiting</Badge>}
            </div>
            <p className="ql-subdued mt-3">Current token</p>
            <p className="text-2xl font-medium tracking-tight">{current?.code ?? '–'}</p>
            <Button size="sm" className="mt-3 w-full" to="/admin/queues">Open console</Button>
          </div>
        );
      })}
    </div>
  );
}

function Recommended({ business }) {
  const dismissed = useUiStore((s) => s.dismissed.recommended);
  const dismiss = useUiStore((s) => s.dismiss);
  const cards = [
    { id: 'tv', title: 'Put your line on the big screen', text: 'Show "now serving" on any TV in your waiting area.', feature: 'tvDisplay', to: '/admin/channels' },
    { id: 'sms', title: 'Send SMS when a turn is near', text: 'Reach customers who closed the page.', feature: 'smsAlerts', to: '/admin/settings?tab=notifications' },
    { id: 'priority', title: 'Serve seniors first, fairly', text: 'Priority tokens move ahead without skipping the line for everyone.', feature: 'priorityQueues', to: '/admin/settings?tab=rules' },
  ].filter((c) => !dismissed.includes(c.id));
  if (!cards.length) return null;
  return (
    <section aria-labelledby="rec-title">
      <h2 id="rec-title" className="mb-2 text-sm font-medium">Recommended for you</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((c) => {
          const locked = !hasFeature(business.plan, c.feature);
          return (
            <div key={c.id} className="ql-card relative p-4">
              <button type="button" onClick={() => dismiss('recommended', [...dismissed, c.id])} className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md hover:bg-black/5 dark:hover:bg-white/10" aria-label={`Dismiss "${c.title}"`}>
                <X className="h-4 w-4" />
              </button>
              {locked ? <Badge tone="neutral" icon={Lock}>Paid plans</Badge> : <Badge tone="success">Included</Badge>}
              <p className="mt-2 pr-6 text-[13px] font-medium">{c.title}</p>
              <p className="ql-subdued mt-1">{c.text}</p>
              <Link to={locked ? '/admin/billing' : c.to} className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-[#005BD3] hover:underline dark:text-sky-400">
                {locked ? 'See plans' : 'Set it up'} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function AdminHome() {
  const { business, user } = useTenant();
  const tokens = useTenantTokens();
  const activity = useTenantCollection(useBusinessStore, 'activity');
  const history = useBusinessStore((s) => s.analytics[business.id]);
  const hourly = useMemo(() => hourlySeries(history), [history]);
  const loading = useFakeLoading();

  if (loading) return <SkeletonPage />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-medium tracking-tight">{greeting()}, {user.name.split(' ')[0]}</h1>
        <div className="flex gap-2">
          <Button size="sm" href={`/${business.slug}`} target="_blank" rel="noopener">View join page</Button>
          <Button size="sm" variant="primary" to="/admin/queues">Open queues</Button>
        </div>
      </div>
      {!business.isLive && (
        <Banner tone="warning" title="Your queue is not live yet" action={<Button size="sm" variant="primary" to="/admin/channels">Finish go-live checklist</Button>}>
          Customers who open your link will see "This queue is not open yet" until you go live.
        </Banner>
      )}
      <SetupGuide business={business} />
      <TodayCard tokens={tokens} history={history} />

      <section aria-labelledby="now-title">
        <h2 id="now-title" className="mb-2 text-sm font-medium">Queue right now</h2>
        <QueueNow business={business} tokens={tokens} />
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card title="Customers per hour" subtitle="Average over the last 30 days">
          {hourly.length ? <BarChartBox data={hourly} dataKey="customers" name="Customers" /> : <EmptyState compact title="No history yet" description="Once customers join, busy hours show up here." />}
        </Card>
        <Card title="Recent activity">
          {activity.length === 0 ? (
            <EmptyState compact title="Nothing yet" description="Changes and queue events will show here." />
          ) : (
            <ul className="space-y-3">
              {activity.slice(0, 6).map((a) => {
                const Icon = ACTIVITY_ICONS[a.kind] ?? Settings2;
                return (
                  <li key={a.id} className="flex gap-3 text-[13px]">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F1F1F1] dark:bg-neutral-800"><Icon className="h-3.5 w-3.5" aria-hidden="true" /></span>
                    <div className="min-w-0">
                      <p>{a.text}</p>
                      <p className="ql-subdued">{timeAgo(a.at)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
      <Recommended business={business} />
    </div>
  );
}
