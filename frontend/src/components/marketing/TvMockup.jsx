import { cx } from '../../lib/cx';

export default function TvMockup({ className, large }) {
  return (
    <div className={cx('rounded-2xl border-[6px] border-[#1B1B1B] bg-[#07110F] text-white shadow-mock', className)} aria-hidden="true">
      <div className={cx('grid grid-cols-[1.4fr_1fr] gap-3', large ? 'p-6' : 'p-4')}>
        <div>
          <p className="text-[10px] uppercase tracking-[.2em] text-white/50">Now serving</p>
          <p className={cx('font-medium tracking-tight text-[#5FD3C4]', large ? 'text-6xl md:text-7xl' : 'text-4xl')}>A-023</p>
          <p className="mt-1 text-xs text-white/60">Dr. Ananya Rao, Room 2</p>
        </div>
        <div className="border-l border-white/10 pl-3">
          <p className="text-[10px] uppercase tracking-[.2em] text-white/50">Next</p>
          {['A-024', 'A-025', 'A-026'].map((t) => (
            <p key={t} className={cx('font-medium text-white/80', large ? 'text-2xl' : 'text-base')}>{t}</p>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-white/10 px-4 py-2 text-[10px] text-white/50">
        <span>12 waiting</span>
        <span>Scan to join</span>
      </div>
    </div>
  );
}
