import { cx } from '../../lib/cx';

export default function TokenCard({ code, label = 'Your token', tone = 'default', pulse, children }) {
  const tones = {
    default: 'bg-white text-[#1A1A1A] ring-1 ring-black/5 dark:bg-neutral-900 dark:text-white dark:ring-white/10',
    brand: 'bg-[var(--brand)] text-[var(--brand-contrast)]',
    success: 'bg-[#1F7A4C] text-white',
    muted: 'bg-black/5 text-[#1A1A1A] dark:bg-white/10 dark:text-white',
  };
  return (
    <div className={cx('rounded-3xl p-6 text-center shadow-sm', tones[tone])}>
      <p className="text-sm opacity-75">{label}</p>
      <p className={cx('mt-1 text-[64px] font-medium leading-none tracking-[-0.03em] tabular-nums', pulse && 'animate-pulse')} aria-label={`Token ${code.split('').join(' ')}`}>{code}</p>
      {children}
    </div>
  );
}
