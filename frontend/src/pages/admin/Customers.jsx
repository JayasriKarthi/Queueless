import { useEffect, useState } from 'react';
import { Search, Download, Lock, Star } from 'lucide-react';
import { useTenant } from '../../hooks/useTenant';
import { useFeature } from '../../hooks/useFeature';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import { getCustomers, downloadCustomersCsv } from '../../lib/fakeBackend';
import { TOKEN_STATUS } from '../../config/constants';
import { formatDateTime, formatTime, minutesBetween, formatDate } from '../../lib/formatters';
import PageHeader from '../../components/ui/PageHeader';
import Table, { Pagination } from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Drawer from '../../components/ui/Drawer';
import EmptyState from '../../components/ui/EmptyState';
import { toast } from '../../store/uiStore';

const PAGE_SIZE = 15;

function Timeline({ token, business }) {
  const resource = business.resources.find((r) => r.id === token.resourceId);
  const steps = [
    ['Joined the line', token.createdAt, token.source === 'walk-in' ? 'Added by staff as a walk-in' : 'Joined from the QR code or link'],
    token.calledAt && ['Called', token.calledAt, resource ? `By ${resource.name}` : null],
    token.servedAt && ['Service started', token.servedAt],
    token.status === 'DONE' && ['Done', token.doneAt, token.rating ? `Rated ${token.rating} of 5` : null],
    token.status === 'NO_SHOW' && ['Marked as no-show', token.doneAt],
    token.status === 'CANCELLED' && [token.cancelledBy === 'customer' ? 'Left the line' : 'Removed by staff', token.cancelledAt],
  ].filter(Boolean);
  return (
    <ol className="relative ml-2 border-l border-admin-border pl-5 dark:border-neutral-700">
      {steps.map(([label, at, note]) => (
        <li key={label} className="mb-5 last:mb-0">
          <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-[#303030] dark:bg-teal" aria-hidden="true" />
          <p className="font-medium">{label}</p>
          <p className="ql-subdued">{at ? formatDateTime(at) : ''}</p>
          {note && <p className="text-[13px]">{note}</p>}
        </li>
      ))}
    </ol>
  );
}

export default function Customers() {
  const { business } = useTenant();
  const csv = useFeature('csvExport');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState(''); // `query` after a short pause in typing
  const [status, setStatus] = useState('');
  const [service, setService] = useState('');
  const [range, setRange] = useState('30');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setSearch(query), 300);
    return () => clearTimeout(id);
  }, [query]);

  // Filtered and paged on the server; reloads live as tokens are created and change.
  const filters = { q: search, status, serviceId: service, days: Number(range) };
  const { data, loading, error } = useLiveQuery(() => getCustomers({ ...filters, page, pageSize: PAGE_SIZE }), [search, status, service, range, page], { delay: 800 });
  const pageRows = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageCount = data?.pages ?? 1;
  const svcName = (t) => t.serviceName ?? business.services.find((s) => s.id === t.serviceId)?.name ?? 'Removed service';
  const filter = (setter) => (e) => {
    setter(e.target.value);
    setPage(1);
  };
  useEffect(() => setPage(1), [search]);

  const exportCsv = async () => {
    setExporting(true);
    const res = await downloadCustomersCsv(filters);
    setExporting(false);
    toast(res.ok ? `Downloaded ${res.name}` : res.error, { tone: res.ok ? 'default' : 'critical' });
  };

  const columns = [
    { key: 'code', header: 'Token', render: (t) => <span className="font-medium">{t.code}</span> },
    { key: 'name', header: 'Customer', render: (t) => <span><span className="block">{t.customer.name}</span><span className="block text-xs text-admin-muted">{t.customer.phone}</span></span> },
    { key: 'service', header: 'Service', className: 'hidden md:table-cell', render: (t) => svcName(t) },
    { key: 'joined', header: 'Joined', className: 'hidden sm:table-cell', render: (t) => <span className="whitespace-nowrap">{formatDate(t.createdAt)}, {formatTime(t.createdAt)}</span> },
    { key: 'wait', header: 'Wait', className: 'hidden lg:table-cell', render: (t) => (t.calledAt ? `${minutesBetween(t.createdAt, t.calledAt)} min` : '–') },
    { key: 'status', header: 'Status', render: (t) => <Badge tone={TOKEN_STATUS[t.status].tone}>{TOKEN_STATUS[t.status].label}</Badge> },
  ];

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle="Every token, newest first"
        primary={
          csv.enabled ? (
            <Button variant="primary" icon={Download} onClick={exportCsv} loading={exporting} disabled={!total}>Export CSV</Button>
          ) : (
            <Button icon={Lock} to="/admin/billing?upgrade=business" title="CSV export is on the Business plan">Export CSV ({csv.requiredPlan.name})</Button>
          )
        }
      />
      <div className="ql-card overflow-hidden">
        <div className="grid gap-2 p-2 sm:grid-cols-2 lg:grid-cols-[1fr_160px_200px_150px]">
          <Input aria-label="Search customers" placeholder="Search name, phone, or token" prefix={<Search className="h-4 w-4" />} value={query} onChange={filter(setQuery)} />
          <Select aria-label="Status" value={status} onChange={filter(setStatus)} options={[{ value: '', label: 'All statuses' }, ...Object.entries(TOKEN_STATUS).map(([k, v]) => ({ value: k, label: v.label }))]} />
          <Select aria-label="Service" value={service} onChange={filter(setService)} options={[{ value: '', label: 'All services' }, ...business.services.map((s) => ({ value: s.id, label: s.name }))]} />
          <Select aria-label="Date range" value={range} onChange={filter(setRange)} options={[{ value: '1', label: 'Last 24 hours' }, { value: '7', label: 'Last 7 days' }, { value: '30', label: 'Last 30 days' }, { value: '90', label: 'Last 90 days' }]} />
        </div>
        <Table
          caption="Token history"
          columns={columns}
          rows={pageRows}
          loading={loading && !data}
          onRowClick={setOpen}
          empty={<EmptyState compact title={error ? 'Could not load customers' : 'No tokens found'} description={error ?? (query || status || service ? 'Try clearing your filters.' : 'Tokens appear here once customers join.')} />}
        />
        {total > 0 && <Pagination page={page} pageCount={pageCount} onChange={setPage} total={total} label="tokens" />}
      </div>
      <Drawer open={Boolean(open)} onClose={() => setOpen(null)} title={open ? `Token ${open.code}` : ''}>
        {open && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base font-medium">{open.customer.name}</p>
                <p className="ql-subdued">{open.customer.phone}</p>
              </div>
              <Badge tone={TOKEN_STATUS[open.status].tone}>{TOKEN_STATUS[open.status].label}</Badge>
            </div>
            <dl className="grid grid-cols-2 gap-3 rounded-xl bg-[#F7F7F7] p-3 text-[13px] dark:bg-neutral-800">
              <div><dt className="ql-subdued">Service</dt><dd>{svcName(open)}</dd></div>
              {business.settings.customerFields.filter((f) => !['name', 'phone'].includes(f.key)).map((f) => (
                <div key={f.key}><dt className="ql-subdued">{f.label}</dt><dd>{open.customer[f.key] ?? '–'}</dd></div>
              ))}
              {open.priority && <div><dt className="ql-subdued">Priority</dt><dd>Yes</dd></div>}
              {open.rating && <div><dt className="ql-subdued">Rating</dt><dd className="flex items-center gap-1">{open.rating} <Star className="h-3.5 w-3.5 fill-current" aria-hidden="true" /></dd></div>}
            </dl>
            <div>
              <h3 className="mb-3 text-[13px] font-medium">Timeline</h3>
              <Timeline token={open} business={business} />
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
