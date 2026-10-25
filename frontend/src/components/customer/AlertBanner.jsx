import { BellRing } from 'lucide-react';
import { cx } from '../../lib/cx';

export default function AlertBanner({ tone = 'attention', title, children, icon: Icon = BellRing, action }) {
  return (
    <div role="alert" className={cx('flex gap-3 rounded-2xl p-4', tone === 'attention' ? 'bg-[#FFF1C2] text-[#4F3A00] dark:bg-amber-900/40 dark:text-amber-100' : 'bg-black/5 dark:bg-white/10')}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="flex-1">
        <p className="font-medium">{title}</p>
        {children && <p className="mt-0.5 text-sm opacity-90">{children}</p>}
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}
