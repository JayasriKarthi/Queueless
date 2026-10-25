import { cx } from '../../lib/cx';

const TONES = {
  success: 'bg-[#CDFEE1] text-[#0C5132] dark:bg-emerald-900/50 dark:text-emerald-200',
  info: 'bg-[#E0F0FF] text-[#00527C] dark:bg-sky-900/50 dark:text-sky-200',
  attention: 'bg-[#FFEF9D] text-[#4F4700] dark:bg-amber-900/50 dark:text-amber-200',
  critical: 'bg-[#FEDAD9] text-[#8E0B21] dark:bg-red-900/50 dark:text-red-200',
  neutral: 'bg-[#E3E3E3] text-[#4A4A4A] dark:bg-neutral-800 dark:text-neutral-300',
  teal: 'bg-teal-50 text-teal-900 dark:bg-teal-900/40 dark:text-teal-100',
  dark: 'bg-[#303030] text-white',
};

const DOTS = { success: 'bg-[#29845A]', info: 'bg-[#0094D5]', attention: 'bg-[#B28400]', critical: 'bg-[#E51C00]', neutral: 'bg-[#8A8A8A]', teal: 'bg-teal', dark: 'bg-white' };

export default function Badge({ tone = 'neutral', dot, icon: Icon, children, className }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap', TONES[tone], className)}>
      {dot && <span className={cx('h-1.5 w-1.5 rounded-full', DOTS[tone])} aria-hidden="true" />}
      {Icon && <Icon className="h-3 w-3" aria-hidden="true" />}
      {children}
    </span>
  );
}
