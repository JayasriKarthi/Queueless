import { Lock } from 'lucide-react';
import { useFeature } from '../../hooks/useFeature';
import { cx } from '../../lib/cx';
import Button from './Button';
import Badge from './Badge';
import UsageMeter from './UsageMeter';

export function LockBadge({ plan }) {
  return (
    <Badge tone="neutral" icon={Lock}>
      {plan}
    </Badge>
  );
}

// Renders children when the plan includes `feature`; otherwise a lock card with an upgrade prompt.
export default function LockedFeature({ feature, title, description, usage, children, className, compact, preview }) {
  const { enabled, requiredPlan } = useFeature(feature);
  if (enabled) return children ?? null;
  return (
    <div className={cx('relative overflow-hidden rounded-xl border border-dashed border-[#C9C9C9] bg-[#FAFAFA] dark:bg-neutral-900 dark:border-neutral-700', compact ? 'p-3' : 'p-5', className)}>
      {preview && <div className="pointer-events-none select-none opacity-40 blur-[2px] mb-4" aria-hidden="true">{preview}</div>}
      <div className={cx('flex gap-3', compact ? 'items-center' : 'items-start')}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white border border-admin-border dark:bg-neutral-800 dark:border-neutral-700">
          <Lock className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            {title} <span className="sr-only">(locked)</span>
          </p>
          {!compact && description && <p className="ql-subdued mt-0.5">{description}</p>}
          {usage && <UsageMeter {...usage} />}
          {!compact && (
            <Button variant="primary" size="sm" className="mt-3" to={`/admin/billing?upgrade=${requiredPlan.id}`}>
              Upgrade to {requiredPlan.name}
            </Button>
          )}
        </div>
        {compact && (
          <Button variant="secondary" size="sm" to={`/admin/billing?upgrade=${requiredPlan.id}`}>
            Upgrade
          </Button>
        )}
      </div>
    </div>
  );
}
