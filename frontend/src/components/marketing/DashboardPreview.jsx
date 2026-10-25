import { Search, Home, ListOrdered, Layers, UserRound, BarChart3, Radio, Bell } from 'lucide-react';
import MetricTile from '../admin/MetricTile';
import Badge from '../ui/Badge';
import ProgressBar from '../ui/ProgressBar';
import { LogoMark } from '../ui/Logo';
import { cx } from '../../lib/cx';

// A live-looking admin screenshot built from the real admin components.
const NAV = [
  [Home, 'Home', true],
  [ListOrdered, 'Queues'],
  [Layers, 'Services'],
  [UserRound, 'Doctors'],
  [BarChart3, 'Analytics'],
  [Radio, 'Channels'],
];
const BARS = [18, 32, 46, 60, 52, 38, 30, 44, 58, 40];

export default function DashboardPreview({ className }) {
  return (
    <div className={cx('overflow-hidden rounded-xl2 border border-black/10 bg-admin-bg text-left text-[13px] text-[#303030] shadow-mock', className)} aria-hidden="true">
      <div className="flex h-11 items-center gap-3 bg-admin-top px-3">
        <LogoMark size={22} dark />
        <span className="hidden text-white/90 sm:inline">City Care Clinic</span>
        <div className="mx-auto flex h-7 w-full max-w-xs items-center gap-2 rounded-lg bg-admin-search px-2.5 text-xs text-white/60">
          <Search className="h-3.5 w-3.5" /> Search
          <span className="ml-auto rounded border border-white/20 px-1 text-[10px]">Ctrl K</span>
        </div>
        <Bell className="h-4 w-4 text-white/70" />
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal text-[10px] font-medium text-white">MK</span>
      </div>
      <div className="flex">
        <div className="hidden w-40 shrink-0 space-y-0.5 p-2 sm:block">
          {NAV.map(([Icon, label, sel]) => (
            <div key={label} className={cx('flex items-center gap-2 rounded-lg px-2 py-1.5', sel && 'bg-white font-medium shadow-card')}>
              <Icon className="h-4 w-4" /> {label}
              {label === 'Queues' && <span className="ml-auto rounded-full bg-[#E3E3E3] px-1.5 text-[10px]">12</span>}
            </div>
          ))}
        </div>
        <div className="min-w-0 flex-1 space-y-3 p-3">
          <p className="text-base font-medium">Good morning, Meera</p>
          <div className="ql-card p-3">
            <div className="flex items-center justify-between">
              <span className="font-medium">Setup guide</span>
              <span className="text-xs text-admin-muted">5 of 6 tasks complete</span>
            </div>
            <ProgressBar value={5} max={6} className="mt-2" />
          </div>
          <div className="ql-card">
            <div className="flex flex-wrap px-1 pt-1">
              <MetricTile label="Tokens today" value="128" change={12} spark={[8, 12, 10, 14, 13, 17, 19]} />
              <MetricTile label="Average wait" value="9 min" change={-18} goodWhenDown spark={[16, 14, 15, 12, 11, 10, 9]} />
              <MetricTile label="Served" value="104" change={9} spark={[6, 9, 8, 11, 10, 12, 14]} className="hidden md:block" />
            </div>
            <div className="flex h-24 items-end gap-1.5 px-4 pb-3 pt-2">
              {BARS.map((h, i) => (
                <div key={i} className={cx('flex-1 rounded-t', i === 8 ? 'bg-teal' : 'bg-teal/30')} style={{ height: `${h + 20}%` }} />
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[['Dr. Ananya Rao', 'A-023', 4], ['Dr. Vikram Menon', 'B-011', 2]].map(([name, tok, w]) => (
              <div key={name} className="ql-card flex items-center justify-between p-3">
                <div>
                  <p className="text-xs text-admin-muted">{name}</p>
                  <p className="text-lg font-medium">{tok}</p>
                </div>
                <Badge tone="info" dot>{w} waiting</Badge>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
