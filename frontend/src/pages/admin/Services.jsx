import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus } from 'lucide-react';
import { useTenant, useTenantTokens } from '../../hooks/useTenant';
import { useFakeLoading } from '../../hooks/useFakeLoading';
import { deleteServices, setServicesActive } from '../../lib/fakeBackend';
import { toast } from '../../store/uiStore';
import PageHeader from '../../components/ui/PageHeader';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Tabs from '../../components/ui/Tabs';
import EmptyState from '../../components/ui/EmptyState';
import ConfirmDialog from '../../components/ui/ConfirmDialog';

export default function Services() {
  const { business } = useTenant();
  const tokens = useTenantTokens();
  const navigate = useNavigate();
  const loading = useFakeLoading();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [selected, setSelected] = useState([]);
  const [confirm, setConfirm] = useState(false);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return business.services
      .filter((s) => status === 'all' || (status === 'active' ? s.isActive : !s.isActive))
      .filter((s) => !q || s.name.toLowerCase().includes(q))
      .map((s) => ({
        ...s,
        handledBy: business.resources.filter((r) => r.serviceIds.includes(s.id)).map((r) => r.name),
        waiting: tokens.filter((t) => t.serviceId === s.id && t.status === 'WAITING').length,
      }));
  }, [business, tokens, query, status]);

  const bulk = (isActive) => {
    setServicesActive(business.id, selected, isActive);
    toast(`${selected.length} service${selected.length > 1 ? 's' : ''} ${isActive ? 'activated' : 'deactivated'}`);
    setSelected([]);
  };
  const doDelete = () => {
    const res = deleteServices(business.id, selected);
    setConfirm(false);
    if (!res.ok) return toast(res.error, { tone: 'critical' });
    toast('Deleted');
    setSelected([]);
  };

  const columns = [
    { key: 'name', header: 'Service', render: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'prefix', header: 'Prefix', render: (r) => <code className="rounded bg-[#F1F1F1] px-1.5 py-0.5 text-xs dark:bg-neutral-800">{r.prefix}</code> },
    { key: 'avg', header: 'Average time', render: (r) => `${r.avgMinutes} min` },
    { key: 'handled', header: 'Handled by', className: 'hidden md:table-cell', render: (r) => <span className="text-admin-muted">{r.handledBy.join(', ') || 'No one yet'}</span> },
    { key: 'waiting', header: 'Waiting', render: (r) => r.waiting },
    { key: 'status', header: 'Status', render: (r) => (r.isActive ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>) },
  ];

  return (
    <div>
      <PageHeader title="Services" subtitle="What customers can queue for" primary={<Button variant="primary" icon={Plus} to="/admin/services/new">Add service</Button>} />
      <div className="ql-card overflow-hidden">
        <Tabs className="px-2" value={status} onChange={setStatus} tabs={[{ id: 'all', label: 'All' }, { id: 'active', label: 'Active' }, { id: 'inactive', label: 'Inactive' }]} />
        <div className="p-2">
          <Input placeholder="Search services" aria-label="Search services" prefix={<Search className="h-4 w-4" />} value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Table
          caption="Services"
          columns={columns}
          rows={rows}
          loading={loading}
          selectable
          selected={selected}
          onSelect={setSelected}
          onRowClick={(r) => navigate(`/admin/services/${r.id}`)}
          bulkActions={
            <>
              <Button size="sm" onClick={() => bulk(true)}>Set active</Button>
              <Button size="sm" onClick={() => bulk(false)}>Set inactive</Button>
              <Button size="sm" variant="destructive" onClick={() => setConfirm(true)}>Delete</Button>
            </>
          }
          empty={
            query || status !== 'all' ? (
              <EmptyState compact title="No services match" description="Try a different search or filter." />
            ) : (
              <EmptyState title="Add your first service" description="Services are what customers queue for, like a consultation or a cash deposit." action={<Button variant="primary" to="/admin/services/new">Add service</Button>} />
            )
          }
        />
      </div>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} onConfirm={doDelete} title={`Delete ${selected.length} service${selected.length > 1 ? 's' : ''}?`} message="Customers will no longer be able to pick these services. Past tokens keep their history." confirmLabel="Delete" />
    </div>
  );
}
