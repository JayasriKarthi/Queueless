import { Lock } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import UsageMeter from '../ui/UsageMeter';

const COPY = {
  counters: { title: 'You have reached your counter limit', label: 'Active counters' },
  staffSeats: { title: 'You have used all your staff seats', label: 'Staff seats' },
  tokensPerDay: { title: 'Daily token limit reached', label: 'Tokens today' },
};

// Hitting a limit never deletes anything; it only asks to upgrade.
export default function UpgradePrompt({ open, onClose, limitKey, usage }) {
  const copy = COPY[limitKey] ?? COPY.counters;
  return (
    <Modal open={open} onClose={onClose} title={copy.title} size="sm" footer={<><Button onClick={onClose}>Not now</Button><Button variant="primary" to="/admin/billing?upgrade=pro" onClick={onClose}>See plans</Button></>}>
      <div className="flex gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F1F1F1] dark:bg-neutral-800"><Lock className="h-4 w-4" /></span>
        <div className="flex-1 space-y-3">
          <p>Upgrade to add more. Everything you have already set up stays exactly as it is, nothing is deleted.</p>
          {usage && <UsageMeter label={copy.label} used={usage.used} limit={usage.limit} />}
        </div>
      </div>
    </Modal>
  );
}
