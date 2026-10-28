import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearTodayQueue, deleteBusiness } from '../../../lib/fakeBackend';
import { toast } from '../../../store/uiStore';
import Button from '../../../components/ui/Button';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';

export default function DangerZoneTab({ business }) {
  const [open, setOpen] = useState(null);
  const navigate = useNavigate();
  return (
    <div className="max-w-2xl space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#F9C1BE] p-4 dark:border-red-900">
        <div>
          <p className="text-[13px] font-medium">Clear today's queue</p>
          <p className="ql-subdued">Cancels every waiting and called token. History is kept.</p>
        </div>
        <Button variant="destructive" onClick={() => setOpen('clear')}>Clear queue</Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#F9C1BE] p-4 dark:border-red-900">
        <div>
          <p className="text-[13px] font-medium">Delete this business</p>
          <p className="ql-subdued">Cancels any paid plan, then removes the business, its staff accounts, and all tokens. Invoices are kept for tax records.</p>
        </div>
        <Button variant="destructive" onClick={() => setOpen('delete')}>Delete business</Button>
      </div>
      <ConfirmDialog open={open === 'clear'} onClose={() => setOpen(null)} title="Clear today's queue?" message="Everyone waiting will see that their token was cancelled." requireText="CLEAR" confirmLabel="Clear queue" onConfirm={async () => {
          const res = await clearTodayQueue(business.id);
          setOpen(null);
          toast(res.ok ? `Queue cleared (${res.count} removed)` : res.error, { tone: res.ok ? 'default' : 'critical' });
        }} />
      <ConfirmDialog open={open === 'delete'} onClose={() => setOpen(null)} title={`Delete ${business.name}?`} message="This cannot be undone." requireText={business.slug} confirmLabel="Delete business" onConfirm={async () => {
          const res = await deleteBusiness(business.id, business.slug);
          setOpen(null);
          if (!res.ok) return toast(res.error, { tone: 'critical' });
          toast('Business deleted');
          navigate('/');
        }} />
    </div>
  );
}
