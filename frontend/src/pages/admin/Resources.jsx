import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus } from 'lucide-react';
import { useTenant, useTenantTokens, useUsage } from '../../hooks/useTenant';
import { useAuthStore } from '../../store/authStore';
import { useFakeLoading } from '../../hooks/useFakeLoading';
import { deleteResources, setResourcesActive } from '../../lib/fakeBackend';
import { waitingFor, currentFor } from '../../lib/queueMath';
import { toast } from '../../store/uiStore';
import PageHeader from '../../components/ui/PageHeader';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Tabs from '../../components/ui/Tabs';
import EmptyState from '../../components/ui/EmptyState';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import UsageMeter from '../../components/ui/UsageMeter';
import UpgradePrompt from '../../components/admin/UpgradePrompt';

export default function Resources() {
  const { business } = useTenant();
  const tokens = useTenantTokens();
  const users = useAuthStore((s) => s.users);
  const usage = useUsage(business);
  const navigate = useNavigate();
  const loading = useFakeLoading();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [selected, setSelected] = useState([]);
  const [confirm, setConfirm] = useState(false);
  const [limitOpen, setLimitOpen] = useState(false);
  const { resource: one, resourcePlural: many } = business.labels;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return business.resources
      .filter((r) => status === 'all' || (status === 'active' ? r.isActive : !r.isActive))
      .filter((r) => !q || r.name.toLowerCase().includes(q))
      .map((r) => ({
        ...r,
        services: business.services.filter((s) => r.serviceIds.includes(s.id)).map((s) => s.name),
        staff: users.filter((u) => u.businessId === business.id && u.resourceId === r.id && u.status === 'active').map((u) => u.name),
        waiting: waitingFor(business, tokens, r.id).length,
        current: currentFor(tokens, business.id, r.id)?.code,
      }));
  }, [business, tokens, users, query, status]);

  const add = () => (usage.counters.used >= usage.counters.limit ? setLimitOpen(true) : navigate('/admin/resources/new'));
  const bulk = (isActive) => {
    const res = setResourcesActive(business.id, selected, isActive);
    if (!res.ok) return setLimitOpen(true);
    toast(`${selected.length} updated`);
    setSelected([]);
  };
  const doDelete = () => {
    const res = deleteResources(business.id, selected);
    setConfirm(false);
    if (!res.ok) return toast(res.error, { tone: 'critical' });
    toast('Deleted');
    setSelected([]);
  };

  const columns = [
    { key: 'name', header: one, render: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'services', header: 'Services', className: 'hidden md:table-cell', render: (r) => <span className="text-admin-muted">{r.services.join(', ') || '–'}</span> },
    { key: 'staff', header: 'Staff', className: 'hidden lg:table-cell', render: (r) => <span className="text-admin-muted">{r.staff.join(', ') || 'Unassigned'}</span> },
    { key: 'current', header: 'Serving', render: (r) => r.current ?? '–' },
    { key: 'waiting', header: 'Waiting', render: (r) => r.waiting },
    { key: 'status', header: 'Status', render: (r) => (!r.isActive ? <Badge>Inactive</Badge> : r.isPaused ? <Badge tone="attention">Paused</Badge> : <Badge tone="success">Active</Badge>) },
  ];

  return (
    <div>
      <PageHeader title={many} subtitle={`Who or what serves your customers. Your business type calls them ${many.toLowerCase()}.`} primary={<Button variant="primary" icon={Plus} onClick={add}>Add {one.toLowerCase()}</Button>} />
      <div className="ql-card mb-4 p-4">
        <UsageMeter label={`Active ${many.toLowerCase()} on your plan`} used={usage.counters.used} limit={usage.counters.limit} help={usage.counters.used > usage.counters.limit ? 'You are over your plan limit. Existing ones keep working; upgrade to add more.' : null} />
      </div>
      <div className="ql-card overflow-hidden">
        <Tabs className="px-2" value={status} onChange={setStatus} tabs={[{ id: 'all', label: 'All' }, { id: 'active', label: 'Active' }, { id: 'inactive', label: 'Inactive' }]} />
        <div className="p-2">
          <Input placeholder={`Search ${many.toLowerCase()}`} aria-label={`Search ${many.toLowerCase()}`} prefix={<Search className="h-4 w-4" />} value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Table
          caption={many}
          columns={columns}
          rows={rows}
          loading={loading}
          selectable
          selected={selected}
          onSelect={setSelected}
          onRowClick={(r) => navigate(`/admin/resources/${r.id}`)}
          bulkActions={
            <>
              <Button size="sm" onClick={() => bulk(true)}>Set active</Button>
              <Button size="sm" onClick={() => bulk(false)}>Set inactive</Button>
              <Button size="sm" variant="destructive" onClick={() => setConfirm(true)}>Delete</Button>
            </>
          }
          empty={query || status !== 'all' ? <EmptyState compact title="Nothing matches" description="Try a different search or filter." /> : <EmptyState title={`Add your first ${one.toLowerCase()}`} action={<Button variant="primary" onClick={add}>Add {one.toLowerCase()}</Button>} />}
        />
      </div>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} onConfirm={doDelete} title={`Delete ${selected.length} ${selected.length > 1 ? many.toLowerCase() : one.toLowerCase()}?`} message="People waiting for them stay in line and can be served by others." confirmLabel="Delete" />
      <UpgradePrompt open={limitOpen} onClose={() => setLimitOpen(false)} limitKey="counters" usage={usage.counters} />
    </div>
  );
}
