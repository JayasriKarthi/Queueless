import { QUEUE_MODES } from '../../../config/constants';
import { hasFeature } from '../../../config/plans';
import Input from '../../../components/ui/Input';
import Toggle from '../../../components/ui/Toggle';
import { LockBadge } from '../../../components/ui/LockedFeature';
import Button from '../../../components/ui/Button';
import { cx } from '../../../lib/cx';

function ModeDiagram({ mode }) {
  const dot = (k) => <span key={k} className="h-2.5 w-2.5 rounded-full bg-teal" />;
  const row = (n, label) => (
    <div key={label} className="flex items-center gap-1.5">
      {Array.from({ length: n }, (_, i) => dot(i))}
      <span className="h-px flex-1 bg-black/20 dark:bg-white/20" />
      <span className="rounded bg-white px-1.5 text-[10px] shadow-card dark:bg-neutral-700">{label}</span>
    </div>
  );
  const rows = { shared: [row(5, 'Any counter')], per_service: [row(3, 'Service A'), row(2, 'Service B')], per_resource: [row(2, 'Person 1'), row(3, 'Person 2'), row(1, 'Person 3')] }[mode];
  return <div className="mt-3 space-y-1.5" aria-hidden="true">{rows}</div>;
}

export default function QueueRulesTab({ business, draft, update }) {
  const s = draft.settings;
  const set = (patch) => update({ settings: { ...s, ...patch } });
  const priorityUnlocked = hasFeature(business.plan, 'priorityQueues');
  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="text-sm font-medium">Queue mode</legend>
        <div className="mt-2 grid gap-3 md:grid-cols-3" role="radiogroup">
          {Object.entries(QUEUE_MODES).map(([id, m]) => (
            <button key={id} type="button" role="radio" aria-checked={s.queueMode === id} onClick={() => set({ queueMode: id })} className={cx('rounded-xl border-2 p-3 text-left transition', s.queueMode === id ? 'border-[#303030] dark:border-white' : 'border-admin-border hover:border-admin-input dark:border-neutral-700')}>
              <p className="text-[13px] font-medium">{m.label}</p>
              <p className="ql-subdued mt-1">{m.help}</p>
              <ModeDiagram mode={id} />
            </button>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 md:grid-cols-3">
        <Input label="Token prefix (shared line)" maxLength={2} value={s.tokenPrefix} onChange={(e) => set({ tokenPrefix: e.target.value.toUpperCase().replace(/[^A-Z]/g, '') })} help="Other modes use each service's prefix" />
        <Input label="Daily token limit" type="number" min={1} value={s.maxTokensPerDay} onChange={(e) => set({ maxTokensPerDay: Number(e.target.value) || 0 })} help={business.plan === 'free' ? 'Your plan also caps this at 50 a day' : 'Stops new joins once reached'} />
        <Input label="No-show timeout (minutes)" type="number" min={1} max={30} value={s.noShowMinutes ?? 5} onChange={(e) => set({ noShowMinutes: Number(e.target.value) || 5 })} help="How long a called customer has to arrive" />
      </div>
      <div className="max-w-xl space-y-4 rounded-xl border border-admin-border p-4 dark:border-neutral-700">
        <div className="flex items-start gap-3">
          <Toggle className="flex-1" label="Priority tokens" help="Offer a priority checkbox for seniors, pregnant women, and people with special needs." checked={s.allowPriority} onChange={(v) => set({ allowPriority: v })} />
          {!priorityUnlocked && <LockBadge plan="Business" />}
        </div>
        {!priorityUnlocked && s.allowPriority && (
          <p className="ql-subdued">
            Saved, but priority only takes effect on the Business plan. <Button variant="plain" to="/admin/billing?upgrade=business">Upgrade</Button>
          </p>
        )}
        <Toggle label={'"Any available" option'} help={`Let customers pick the next free ${business.labels.resource.toLowerCase()} instead of a specific one. Used in one-line-per-person mode.`} checked={s.allowAnyAvailable} disabled={s.queueMode !== 'per_resource'} onChange={(v) => set({ allowAnyAvailable: v })} />
      </div>
    </div>
  );
}
