import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MoreHorizontal, UserPlus, Send, Ban, Repeat, KeyRound, UserMinus, UserCheck, Link2 } from 'lucide-react';
import { useTenant, useUsage } from '../../hooks/useTenant';
import { useAuthStore } from '../../store/authStore';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import { inviteStatus, resendInvite, revokeInvite, updateStaff, resetPin, loadStaff } from '../../lib/fakeBackend';
import { timeAgo, copyText, publicUrl } from '../../lib/formatters';
import { DAY_MS } from '../../config/constants';
import { toast } from '../../store/uiStore';
import PageHeader from '../../components/ui/PageHeader';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Menu from '../../components/ui/Menu';
import Modal from '../../components/ui/Modal';
import Select from '../../components/ui/Select';
import Avatar from '../../components/ui/Avatar';
import Tabs from '../../components/ui/Tabs';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import EmptyState from '../../components/ui/EmptyState';
import UsageMeter from '../../components/ui/UsageMeter';
import InviteStaffPanel from '../../components/admin/InviteStaffPanel';
import MockEmailPreview from '../../components/admin/MockEmailPreview';
import UpgradePrompt from '../../components/admin/UpgradePrompt';

const STATUS = {
  active: { label: 'Active', tone: 'success' },
  pending: { label: 'Invited', tone: 'info' },
  expired: { label: 'Expired', tone: 'critical' },
  revoked: { label: 'Revoked', tone: 'neutral' },
  deactivated: { label: 'Revoked', tone: 'neutral' },
};

export default function Staff() {
  const { business } = useTenant();
  const usage = useUsage(business);
  const users = useAuthStore((s) => s.users);
  const invites = useAuthStore((s) => s.invites);
  // Loaded from the server, and again when something happens (an invite accepted, ...).
  const { loading } = useLiveQuery(loadStaff, [], { events: ['notification:new', 'business:updated'] });
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState('all');
  const [preview, setPreview] = useState(null);
  const [changing, setChanging] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [limit, setLimit] = useState(false);
  const panelOpen = params.get('invite') === '1';
  const setPanel = (open) => setParams(open ? { invite: '1' } : {}, { replace: true });
  const resourceName = (id) => business.resources.find((r) => r.id === id)?.name ?? 'Unassigned';

  const rows = useMemo(() => {
    const now = Date.now();
    const people = users.filter((u) => u.businessId === business.id && u.role !== 'owner').map((u) => ({ id: u.id, kind: 'user', name: u.name, email: u.email, role: u.role, resourceId: u.resourceId, status: u.status, lastLoginAt: u.lastLoginAt, color: u.avatarColor, raw: u }));
    const pending = invites.filter((i) => i.businessId === business.id && i.status !== 'accepted').map((i) => ({ id: i.id, kind: 'invite', name: null, email: i.email, role: i.role, resourceId: i.resourceId, status: inviteStatus(i, now), expiresIn: Math.max(0, Math.ceil((i.expiresAt - now) / DAY_MS)), raw: i }));
    return [...people, ...pending].filter((r) => tab === 'all' || (tab === 'active' ? r.status === 'active' : r.kind === 'invite'));
  }, [users, invites, business, tab]);

  const resend = async (invite) => {
    const res = await resendInvite(invite.id);
    if (!res.ok && res.error === 'seat_limit') return setLimit(true);
    if (!res.ok) return toast(res.error, { tone: 'critical' });
    toast('New invite link created. The old link no longer works.');
    setPreview(res.invite);
  };

  const actionsFor = (row) => {
    if (row.kind === 'invite') {
      return [
        row.status !== 'revoked' && { label: 'Resend', icon: Send, onClick: () => resend(row.raw) },
        // The server keeps only a hash of each link, so a link can be copied only right after it was made.
        row.status === 'pending' && row.raw.token && { label: 'Copy link', icon: Link2, onClick: async () => (await copyText(publicUrl(`/accept-invite/${row.raw.token}`))) && toast('Invite link copied') },
        row.status === 'pending' && { label: 'Revoke', icon: Ban, tone: 'critical', onClick: () => setConfirm({ type: 'revoke', row }) },
        row.status === 'revoked' && { label: 'Invite again', icon: Send, onClick: () => resend(row.raw) },
      ];
    }
    if (row.status !== 'active') {
      return [{
        label: 'Reactivate', icon: UserCheck,
        onClick: async () => {
          const r = await updateStaff(row.id, { status: 'active' });
          if (r.ok) toast(`${row.name} reactivated`);
          else if (r.error === 'seat_limit') setLimit(true);
          else toast(r.error, { tone: 'critical' });
        },
      }];
    }
    return [
      { label: `Change ${business.labels.resource.toLowerCase()}`, icon: Repeat, onClick: () => setChanging({ row, value: row.resourceId ?? '' }) },
      { label: 'Reset PIN', icon: KeyRound, onClick: () => setConfirm({ type: 'pin', row }) },
      { divider: true },
      { label: 'Deactivate', icon: UserMinus, tone: 'critical', onClick: () => setConfirm({ type: 'deactivate', row }) },
    ];
  };

  const runConfirm = async () => {
    const { type, row } = confirm;
    setConfirm(null);
    if (type === 'revoke') {
      const res = await revokeInvite(row.id);
      toast(res.ok ? 'Invite revoked' : res.error, { tone: res.ok ? 'default' : 'critical' });
    } else if (type === 'deactivate') {
      const res = await updateStaff(row.id, { status: 'deactivated' });
      toast(res.ok ? `${row.name} can no longer log in` : res.error, { tone: res.ok ? 'default' : 'critical' });
    } else {
      const res = await resetPin(row.id);
      toast(res.ok ? `New PIN for ${row.name}: ${res.pin}` : res.error, { tone: res.ok ? 'default' : 'critical', duration: 10000 });
    }
  };

  const columns = [
    {
      key: 'name', header: 'Name',
      render: (r) => (
        <span className="flex items-center gap-2.5">
          <Avatar name={r.name ?? r.email} color={r.kind === 'invite' ? '#8A8A8A' : r.color} size={28} />
          <span className="min-w-0">
            <span className="block truncate font-medium">{r.name ?? 'Pending invite'}</span>
            <span className="block truncate text-xs text-admin-muted">{r.email}</span>
          </span>
        </span>
      ),
    },
    { key: 'role', header: 'Role', render: (r) => (r.role === 'manager' ? 'Manager' : 'Staff') },
    { key: 'resource', header: business.labels.resource, className: 'hidden md:table-cell', render: (r) => resourceName(r.resourceId) },
    {
      key: 'status', header: 'Status',
      render: (r) => (
        <span className="flex flex-col items-start gap-0.5">
          <Badge tone={STATUS[r.status].tone} dot>{STATUS[r.status].label}</Badge>
          {r.status === 'pending' && <span className={`text-xs ${r.expiresIn <= 1 ? 'text-[#8E0B21] dark:text-red-300' : 'text-admin-muted'}`}>Expires in {r.expiresIn} day{r.expiresIn === 1 ? '' : 's'}</span>}
        </span>
      ),
    },
    { key: 'login', header: 'Last login', className: 'hidden sm:table-cell', render: (r) => <span className="text-admin-muted">{r.lastLoginAt ? timeAgo(r.lastLoginAt) : '–'}</span> },
    {
      key: 'menu', header: <span className="sr-only">Actions</span>, className: 'w-12',
      render: (r) => (
        <Menu
          trigger={(props) => (
            <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10" aria-label={`Actions for ${r.name ?? r.email}`} {...props}>
              <MoreHorizontal className="h-4 w-4" />
            </button>
          )}
          items={actionsFor(r)}
        />
      ),
    },
  ];

  const confirmCopy = confirm && {
    revoke: { title: `Revoke invite for ${confirm.row.email}?`, message: 'The invite link stops working and the seat is freed.', label: 'Revoke' },
    deactivate: { title: `Deactivate ${confirm.row.name}?`, message: 'They will be logged out and cannot log in. Their history is kept and you can reactivate them later.', label: 'Deactivate' },
    pin: { title: `Reset PIN for ${confirm.row.name}?`, message: 'A new 4-digit PIN is created. Share it with them in person.', label: 'Reset PIN' },
  }[confirm.type];

  return (
    <div>
      <PageHeader title="Staff" subtitle="Everyone logs in at the same login page and only sees this business" primary={<Button variant="primary" icon={UserPlus} onClick={() => setPanel(true)}>Invite staff</Button>} />
      <div className="ql-card mb-4 p-4">
        <UsageMeter label="Staff seats" used={usage.staffSeats.used} limit={usage.staffSeats.limit} help={usage.staffSeats.used > usage.staffSeats.limit ? 'You are over your plan limit. Everyone keeps access; upgrade to invite more.' : 'Active staff and pending invites use a seat.'} />
      </div>
      <div className="ql-card overflow-hidden">
        <Tabs className="px-2" value={tab} onChange={setTab} tabs={[{ id: 'all', label: 'All' }, { id: 'active', label: 'Active' }, { id: 'invites', label: 'Invites' }]} />
        <Table caption="Staff and invites" columns={columns} rows={rows} loading={loading} empty={<EmptyState title="Invite your team" description="Staff run the console for their assigned counter or doctor." action={<Button variant="primary" onClick={() => setPanel(true)}>Invite staff</Button>} />} />
      </div>
      <InviteStaffPanel
        open={panelOpen}
        onClose={() => setPanel(false)}
        business={business}
        usage={usage}
        onSent={(invite) => {
          setPanel(false);
          toast(`Invite created for ${invite.email}`);
          setPreview(invite);
        }}
      />
      <MockEmailPreview invite={preview} business={business} onClose={() => setPreview(null)} />
      <Modal
        open={Boolean(changing)}
        onClose={() => setChanging(null)}
        title={`Change ${business.labels.resource.toLowerCase()}`}
        size="sm"
        footer={<><Button onClick={() => setChanging(null)}>Cancel</Button><Button variant="primary" onClick={async () => {
          const res = await updateStaff(changing.row.id, { resourceId: changing.value });
          toast(res.ok ? `${changing.row.name} now works on ${resourceName(changing.value)}` : res.error, { tone: res.ok ? 'default' : 'critical' });
          setChanging(null);
        }}>Save</Button></>}
      >
        {changing && <Select label={`${changing.row.name} can serve`} value={changing.value} onChange={(e) => setChanging({ ...changing, value: e.target.value })} options={business.resources.map((r) => ({ value: r.id, label: r.name }))} />}
      </Modal>
      <ConfirmDialog open={Boolean(confirm)} onClose={() => setConfirm(null)} onConfirm={runConfirm} title={confirmCopy?.title} message={confirmCopy?.message} confirmLabel={confirmCopy?.label} tone={confirm?.type === 'pin' ? 'primary' : 'destructive'} />
      <UpgradePrompt open={limit} onClose={() => setLimit(false)} limitKey="staffSeats" usage={usage.staffSeats} />
    </div>
  );
}
