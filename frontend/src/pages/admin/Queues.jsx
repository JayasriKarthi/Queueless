import { useState } from 'react';
import { Search } from 'lucide-react';
import { useTenant, useTenantTokens } from '../../hooks/useTenant';
import { useQueueStore } from '../../store/queueStore';
import { setQueueOpen } from '../../lib/fakeBackend';
import { toast } from '../../store/uiStore';
import { QUEUE_MODES } from '../../config/constants';
import PageHeader from '../../components/ui/PageHeader';
import QueueBoard from '../../components/admin/QueueBoard';
import Select from '../../components/ui/Select';
import Input from '../../components/ui/Input';
import Toggle from '../../components/ui/Toggle';
import Banner from '../../components/ui/Banner';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import { SkeletonCard } from '../../components/ui/Skeleton';

export default function Queues() {
  const { business } = useTenant();
  const tokens = useTenantTokens();
  const loading = !useQueueStore((s) => s.loaded);
  const [resourceId, setResourceId] = useState('all');
  const [query, setQuery] = useState('');
  const active = business.resources.filter((r) => r.isActive);
  const shown = resourceId === 'all' ? active : active.filter((r) => r.id === resourceId);
  const waiting = tokens.filter((t) => t.status === 'WAITING').length;

  return (
    <div>
      <PageHeader
        title="Queues"
        subtitle={`${QUEUE_MODES[business.settings.queueMode].label} · ${waiting} waiting`}
        badge={business.isLive ? (business.isOpen ? <Badge tone="success" dot>Open</Badge> : <Badge tone="attention" dot>Paused</Badge>) : <Badge tone="neutral">Not live</Badge>}
        secondary={<Button href={`/${business.slug}`} target="_blank" rel="noopener">Join as a customer</Button>}
        primary={<Button variant="primary" to="/staff">Open staff console</Button>}
      />
      <div className="ql-card mb-4 flex flex-col gap-3 p-3 sm:flex-row sm:items-end">
        <Select label={`Filter by ${business.labels.resource.toLowerCase()}`} className="sm:w-56" value={resourceId} onChange={(e) => setResourceId(e.target.value)} options={[{ value: 'all', label: `All ${business.labels.resourcePlural.toLowerCase()}` }, ...active.map((r) => ({ value: r.id, label: r.name }))]} />
        <Input label="Search waiting list" className="flex-1" placeholder="Token or name" prefix={<Search className="h-4 w-4" />} value={query} onChange={(e) => setQuery(e.target.value)} />
        <Toggle className="sm:pb-2" label="Accepting customers" checked={business.isOpen} onChange={async (v) => {
          const res = await setQueueOpen(business.id, v);
          if (!res.ok) toast(res.error, { tone: 'critical' });
        }} />
      </div>
      {!business.isLive && <Banner tone="warning" className="mb-4" title="Not live yet">Customers cannot join until you go live from the Channels page. You can still test with walk-ins after going live.</Banner>}
      {business.isLive && !business.isOpen && <Banner tone="warning" className="mb-4" title="Queue paused">Public pages show "Closed". Staff can still serve people already waiting.</Banner>}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2"><SkeletonCard lines={5} /><SkeletonCard lines={5} /></div>
      ) : shown.length === 0 ? (
        <EmptyState title={`No active ${business.labels.resourcePlural.toLowerCase()}`} description={`Add a ${business.labels.resource.toLowerCase()} to start serving customers.`} action={<Button variant="primary" to="/admin/resources/new">Add {business.labels.resource.toLowerCase()}</Button>} />
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {shown.map((r) => <QueueBoard key={r.id} business={business} resource={r} query={query} />)}
        </div>
      )}
    </div>
  );
}
