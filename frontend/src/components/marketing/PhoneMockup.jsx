import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { cx } from '../../lib/cx';

// Customer status page in a phone frame. Numbers tick on a loop.
const FRAMES = [
  { ahead: 3, min: 12 },
  { ahead: 2, min: 8 },
  { ahead: 1, min: 4 },
  { ahead: 0, min: 0 },
];

export default function PhoneMockup({ className }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((x) => (x + 1) % FRAMES.length), 2600);
    return () => clearInterval(id);
  }, []);
  const f = FRAMES[i];
  const called = f.ahead === 0;
  return (
    <div className={cx('w-[210px] rounded-[34px] border-[7px] border-ink bg-ink shadow-mock sm:w-[240px]', className)} aria-hidden="true">
      <div className="relative overflow-hidden rounded-[27px] bg-[#F6F7F8] pb-4 text-ink">
        <div className="mx-auto mt-1.5 h-4 w-20 rounded-full bg-ink" />
        <div className="h-1 w-full bg-teal mt-2" />
        <div className="px-4 pt-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#2563EB] text-xs font-medium text-white">C</span>
            <span className="text-xs font-medium">City Care Clinic</span>
            <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-[#0C5132]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#29845A]" /> Live
            </span>
          </div>
          <div className={cx('mt-3 rounded-2xl p-4 text-center transition-colors duration-500', called ? 'bg-[#29845A] text-white' : 'bg-white shadow-card')}>
            <p className={cx('text-[11px]', called ? 'text-white/80' : 'text-black/50')}>{called ? 'It is your turn' : 'Your token'}</p>
            <p className={cx('mt-1 text-4xl font-medium tracking-tight', called && 'animate-pulse')}>A-024</p>
            {!called && (
              <div className="mt-3 grid grid-cols-2 gap-2 text-left">
                <div className="rounded-xl bg-[#F6F7F8] p-2">
                  <p className="text-[10px] text-black/50">Ahead of you</p>
                  <p className="text-lg font-medium tabular-nums">{f.ahead}</p>
                </div>
                <div className="rounded-xl bg-[#F6F7F8] p-2">
                  <p className="text-[10px] text-black/50">About</p>
                  <p className="text-lg font-medium tabular-nums">{f.min} min</p>
                </div>
              </div>
            )}
            {called && <p className="mt-2 text-xs">Please go to Dr. Ananya Rao</p>}
          </div>
          {f.ahead > 0 && f.ahead <= 3 && (
            <div className="mt-2 flex items-center gap-2 rounded-xl bg-[#FFF5D6] px-3 py-2 text-[11px] text-[#5C4400]">
              <Bell className="h-3.5 w-3.5" /> Almost your turn. Head back now.
            </div>
          )}
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/10">
            <div className="h-full rounded-full bg-teal transition-[width] duration-700" style={{ width: `${100 - f.ahead * 22}%` }} />
          </div>
          <p className="mt-2 text-center text-[10px] text-black/45">Now serving A-{String(called ? 24 : 23 - f.ahead).padStart(3, '0')}</p>
        </div>
      </div>
    </div>
  );
}
