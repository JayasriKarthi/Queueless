import { Info, AlertTriangle, AlertOctagon, CheckCircle2, X } from 'lucide-react';
import { cx } from '../../lib/cx';

const TONES = {
  info: { box: 'bg-[#EAF4FF] border-[#B4D7F7] dark:bg-sky-950/40 dark:border-sky-900', icon: Info, color: 'text-[#00527C] dark:text-sky-300' },
  warning: { box: 'bg-[#FFF5D6] border-[#F5DC8A] dark:bg-amber-950/40 dark:border-amber-900', icon: AlertTriangle, color: 'text-[#8A6100] dark:text-amber-300' },
  critical: { box: 'bg-[#FEE9E8] border-[#F9C1BE] dark:bg-red-950/40 dark:border-red-900', icon: AlertOctagon, color: 'text-[#8E0B21] dark:text-red-300' },
  success: { box: 'bg-[#E6F7EE] border-[#A8E3C2] dark:bg-emerald-950/40 dark:border-emerald-900', icon: CheckCircle2, color: 'text-[#0C5132] dark:text-emerald-300' },
};

export default function Banner({ tone = 'info', title, children, action, onDismiss, className }) {
  const t = TONES[tone];
  const Icon = t.icon;
  return (
    <div role={tone === 'critical' ? 'alert' : 'status'} className={cx('flex gap-3 rounded-xl border p-3 text-sm', t.box, className)}>
      <Icon className={cx('mt-0.5 h-5 w-5 shrink-0', t.color)} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cx(title && 'mt-0.5', 'text-[#303030] dark:text-neutral-300')}>{children}</div>}
        {action && <div className="mt-2">{action}</div>}
      </div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="h-7 w-7 shrink-0 rounded-md hover:bg-black/5 flex items-center justify-center" aria-label="Dismiss">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
