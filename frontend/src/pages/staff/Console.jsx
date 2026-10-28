import { useEffect, useMemo, useState } from 'react';
import { UserPlus, Keyboard } from 'lucide-react';
import { useTenant } from '../../hooks/useTenant';
import { useQueueActions } from '../../hooks/useQueueActions';
import { useQueueStore } from '../../store/queueStore';
import Spinner from '../../components/ui/Spinner';
import StaffTopbar from '../../components/staff/StaffTopbar';
import NowServingPanel from '../../components/staff/NowServingPanel';
import WaitingList from '../../components/staff/WaitingList';
import WalkInDialog from '../../components/staff/WalkInDialog';
import { useTokenConfirm } from '../../components/admin/QueueBoard';
import Button from '../../components/ui/Button';
import Banner from '../../components/ui/Banner';
import EmptyState from '../../components/ui/EmptyState';

function Metric({ label, value }) {
  return (
    <div className="ql-card p-3">
      <p className="ql-subdued">{label}</p>
      <p className="mt-1 text-2xl font-medium tabular-nums">{value}</p>
    </div>
  );
}

export default function Console() {
  const { business, user } = useTenant();
  const lines = useQueueStore((s) => s.lines);
  const loaded = useQueueStore((s) => s.loaded);
  const actions = useQueueActions(business);
  const { ask, dialog } = useTokenConfirm(actions);
  const [walkIn, setWalkIn] = useState(false);

  // The server sends only the lines this person may serve: staff get their assigned resource,
  // managers and owners get all of them (and can switch).
  const resources = useMemo(() => lines.map((l) => ({ ...l.resource, isActive: true })), [lines]);
  const [resourceId, setResourceId] = useState(resources[0]?.id);
  useEffect(() => {
    if (!resources.some((r) => r.id === resourceId)) setResourceId(resources[0]?.id);
  }, [resources, resourceId]);
  const resource = resources.find((r) => r.id === resourceId);
  const line = lines.find((l) => l.resource.id === resourceId);
  const current = line?.current ?? null;
  const waiting = line?.waiting ?? [];
  const metrics = line?.metrics ?? { served: 0, noShows: 0, avgWaitMinutes: 0 };

  // Keyboard shortcuts: N call next, D done, X no-show.
  useEffect(() => {
    if (!resource) return undefined;
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target.closest('input, textarea, select, [role="dialog"]') || document.querySelector('[role="dialog"]')) return;
      const k = e.key.toLowerCase();
      if (k === 'n' && !resource.isPaused) actions.callNext(resource.id);
      else if (k === 'd' && current) actions.done(current);
      else if (k === 'x' && current) ask('noShow', current);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [resource, current, actions, ask]);

  return (
    <div>
      <StaffTopbar business={business} user={user} resources={resources} resourceId={resourceId} onResource={setResourceId} resource={resource} onTogglePause={() => actions.togglePause(resource)} />
      <main id="main" className="mx-auto max-w-6xl space-y-4 px-3 py-5">
        <h1 className="sr-only">Staff console for {resource?.name ?? business.name}</h1>
        {!loaded ? (
          <div className="flex justify-center py-20" role="status" aria-label="Loading"><Spinner className="h-6 w-6" /></div>
        ) : !resource ? (
          <EmptyState title={`No ${business.labels.resource.toLowerCase()} assigned`} description="Ask your business owner to assign you in Staff settings." />
        ) : (
          <>
            {!business.isOpen && <Banner tone="warning" title="Queue paused">New customers cannot join right now. You can still serve people who are waiting.</Banner>}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Metric label="Waiting in your line" value={line.waitingCount} />
              <Metric label="Served today" value={metrics.served} />
              <Metric label="Average wait today" value={`${metrics.avgWaitMinutes} min`} />
              <Metric label="No-shows today" value={metrics.noShows} />
            </div>
            <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
              <div className="space-y-3">
                <NowServingPanel business={business} resource={resource} current={current} waitingCount={line.waitingCount} actions={actions} onNoShow={(t) => ask('noShow', t)} />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Button size="lg" icon={UserPlus} className="min-h-[44px]" onClick={() => setWalkIn(true)}>Walk-in</Button>
                  <p className="hidden items-center gap-1.5 text-xs text-admin-muted sm:flex">
                    <Keyboard className="h-4 w-4" aria-hidden="true" /> N call next · D done · X no-show
                  </p>
                </div>
              </div>
              <WaitingList business={business} tokens={waiting} onCall={(t) => actions.callThis(t, resource.id)} onSkip={actions.skip} onRemove={(t) => ask('remove', t)} />
            </div>
            <WalkInDialog open={walkIn} onClose={() => setWalkIn(false)} business={business} resource={resource} />
          </>
        )}
      </main>
      {dialog}
    </div>
  );
}
