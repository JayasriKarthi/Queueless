import { Copy, ExternalLink, Mail } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import BusinessLogo from '../ui/BusinessLogo';
import { copyText, publicUrl, formatDate } from '../../lib/formatters';
import { toast } from '../../store/uiStore';

// What the invite email says. Outside production the server returns the link (and prints the
// email in its terminal), so it can be shared from here while there is no email provider.
export default function MockEmailPreview({ invite, business, onClose }) {
  if (!invite) return null;
  const path = invite.token ? `/accept-invite/${invite.token}` : null;
  const url = path ? publicUrl(path) : 'The link was emailed to them.';
  return (
    <Modal open={Boolean(invite)} onClose={onClose} title="Mock email preview" size="md" footer={<Button variant="primary" onClick={onClose}>Done</Button>}>
      <p className="ql-subdued mb-3 flex items-center gap-1.5"><Mail className="h-4 w-4" aria-hidden="true" /> No email provider is connected yet. Share the link below instead.</p>
      <div className="rounded-xl border border-admin-border dark:border-neutral-700">
        <div className="space-y-0.5 border-b border-admin-border px-4 py-3 text-[13px] dark:border-neutral-700">
          <p><span className="text-admin-muted">To:</span> {invite.email}</p>
          <p><span className="text-admin-muted">Subject:</span> Join {business.name} on QueueLess</p>
        </div>
        <div className="space-y-3 px-4 py-5">
          <BusinessLogo business={business} size={40} />
          <p className="text-base font-medium">You have been invited to join {business.name}</p>
          <p>You will help run the queue as {invite.role === 'manager' ? 'a manager' : 'staff'}. Accept the invite to set your password and an optional PIN.</p>
          <p className="break-all rounded-lg bg-[#F7F7F7] p-2 font-mono text-xs dark:bg-neutral-800">{url}</p>
          <p className="ql-subdued">This link expires on {formatDate(invite.expiresAt)}.</p>
        </div>
      </div>
      {path && <div className="mt-4 flex flex-wrap gap-2">
        <Button icon={Copy} onClick={async () => toast((await copyText(url)) ? 'Invite link copied' : 'Could not copy')}>Copy link</Button>
        <Button icon={ExternalLink} href={path} target="_blank" rel="noopener">Open invite page</Button>
      </div>}
    </Modal>
  );
}
