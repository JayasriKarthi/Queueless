import { useState } from 'react';
import { Pause, Play } from 'lucide-react';
import NowServingPanel from '../staff/NowServingPanel';
import WaitingList from '../staff/WaitingList';
import ConfirmDialog from '../ui/ConfirmDialog';
import Button from '../ui/Button';
import { useQueueActions } from '../../hooks/useQueueActions';
import { waitingFor, currentFor } from '../../lib/queueMath';

// Confirms destructive token actions (no-show, remove) for any queue screen.
export function useTokenConfirm(actions) {
  const [pending, setPending] = useState(null);
  const dialog = (
    <ConfirmDialog
      open={Boolean(pending)}
      onClose={() => setPending(null)}
      title={pending?.kind === 'noShow' ? `Mark ${pending?.token.code} as no-show?` : `Remove ${pending?.token.code}?`}
      message={pending?.kind === 'noShow' ? 'The customer will see that they missed their turn.' : `${pending?.token.customer.name} will be taken out of the line.`}
      confirmLabel={pending?.kind === 'noShow' ? 'Mark no-show' : 'Remove'}
      onConfirm={() => {
        actions[pending.kind](pending.token);
        setPending(null);
      }}
    />
  );
  return { ask: (kind, token) => setPending({ kind, token }), dialog };
}

export default function QueueBoard({ business, resource, tokens, query }) {
  const actions = useQueueActions(business);
  const { ask, dialog } = useTokenConfirm(actions);
  const current = currentFor(tokens, business.id, resource.id);
  const q = query.trim().toLowerCase();
  const waiting = waitingFor(business, tokens, resource.id).filter((t) => !q || t.code.toLowerCase().includes(q) || t.customer.name.toLowerCase().includes(q));
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium">{resource.name}</h2>
        <Button size="sm" icon={resource.isPaused ? Play : Pause} onClick={() => actions.togglePause(resource)}>
          {resource.isPaused ? 'Resume' : 'Pause'}
        </Button>
      </div>
      <NowServingPanel compact business={business} resource={resource} current={current} waitingCount={waiting.length} actions={actions} onNoShow={(t) => ask('noShow', t)} />
      <WaitingList business={business} tokens={waiting} limit={6} onCall={(t) => actions.callThis(t, resource.id)} onSkip={actions.skip} onRemove={(t) => ask('remove', t)} />
      {dialog}
    </div>
  );
}
