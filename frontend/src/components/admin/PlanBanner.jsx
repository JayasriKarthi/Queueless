import { Sparkles, X } from 'lucide-react';
import { useTenant } from '../../hooks/useTenant';
import { useUiStore } from '../../store/uiStore';
import Button from '../ui/Button';
import { PLAN_LIMITS_ON } from '../../config/plans';

// Slim bar under the top bar while on the Free plan (only when plans are enforced: with no
// limits there is nothing to unlock). Dismissal is per business.
export default function PlanBanner() {
  const { business } = useTenant();
  const dismissedMap = useUiStore((s) => s.dismissed.planBanner);
  const dismiss = useUiStore((s) => s.dismiss);
  if (!PLAN_LIMITS_ON || business.plan !== 'free' || dismissedMap?.[business.id]) return null;
  return (
    <div className="flex items-center gap-3 border-b border-[#B4D7F7] bg-[#EAF4FF] px-3 py-1.5 text-[13px] text-[#00314D] dark:border-sky-900 dark:bg-sky-950/60 dark:text-sky-100" role="status">
      <Sparkles className="hidden h-4 w-4 shrink-0 sm:block" aria-hidden="true" />
      <p className="min-w-0 flex-1">You are on the Free plan. Upgrade to unlock the TV display and SMS alerts.</p>
      <Button size="sm" variant="primary" to="/admin/billing">Upgrade</Button>
      <button type="button" onClick={() => dismiss('planBanner', { ...dismissedMap, [business.id]: true })} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md hover:bg-black/5" aria-label="Dismiss plan banner">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
