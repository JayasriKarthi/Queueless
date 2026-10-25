import { cx } from '../../lib/cx';

const TONES = { default: 'bg-[#303030] dark:bg-neutral-200', teal: 'bg-teal', success: 'bg-[#29845A]', attention: 'bg-[#E2A100]', critical: 'bg-[#E51C00]', brand: 'bg-[var(--brand)]' };

export default function ProgressBar({ value, max = 100, tone = 'default', className, label, height = 'h-1.5' }) {
  const pct = max === Infinity ? 0 : Math.max(0, Math.min(100, (value / (max || 1)) * 100));
  return (
    <div
      className={cx('w-full overflow-hidden rounded-full bg-[#E3E3E3] dark:bg-neutral-800', height, className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max === Infinity ? undefined : max}
      aria-valuenow={value}
      aria-label={label}
    >
      <div className={cx('h-full rounded-full transition-[width] duration-500', TONES[tone])} style={{ width: `${pct}%` }} />
    </div>
  );
}
