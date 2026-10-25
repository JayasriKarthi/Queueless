import { QRCodeSVG } from 'qrcode.react';
import { Copy, PhoneCall, Check, UserX, RotateCcw, BellRing, MessageSquare, Lock } from 'lucide-react';
import Badge from '../ui/Badge';
import MetricTile from '../admin/MetricTile';
import TvMockup from './TvMockup';

const frame = 'rounded-xl2 bg-white p-5 shadow-mock sm:p-8';

export function LinkMockup() {
  return (
    <div className={frame} aria-hidden="true">
      <div className="flex flex-col items-center gap-6 sm:flex-row">
        <div className="rounded-2xl border-4 border-[#2563EB] p-3">
          <QRCodeSVG value="https://queueless.app/city-care" size={140} fgColor="#0B1F1C" />
        </div>
        <div className="w-full min-w-0 flex-1">
          <p className="text-sm text-black/50">Your join link</p>
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-black/10 px-3 py-2.5 text-sm">
            <span className="truncate">queueless.app/city-care</span>
            <Copy className="ml-auto h-4 w-4 shrink-0 text-teal" />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge tone="success" dot>Live</Badge>
            <Badge tone="info">A4 poster ready</Badge>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ConsoleMockup() {
  return (
    <div className={frame} aria-hidden="true">
      <div className="flex items-center justify-between">
        <p className="text-sm text-black/50">Now serving</p>
        <Badge tone="success" dot>Serving 3:12</Badge>
      </div>
      <p className="mt-1 text-5xl font-medium tracking-tight">A-023</p>
      <p className="mt-1 text-black/60">Lakshmi Iyer, 64 · Follow-up</p>
      <div className="mt-5 grid grid-cols-3 gap-2 text-sm">
        <span className="col-span-3 flex h-12 items-center justify-center gap-2 rounded-xl bg-[#303030] font-medium text-white"><PhoneCall className="h-4 w-4" /> Call next</span>
        <span className="flex h-10 items-center justify-center gap-1 rounded-xl border border-black/10"><Check className="h-4 w-4" /> Done</span>
        <span className="flex h-10 items-center justify-center gap-1 rounded-xl border border-black/10"><UserX className="h-4 w-4" /> No-show</span>
        <span className="flex h-10 items-center justify-center gap-1 rounded-xl border border-black/10"><RotateCcw className="h-4 w-4" /> Recall</span>
      </div>
      <ul className="mt-5 divide-y divide-black/5 text-sm">
        {[['A-024', 'Rahul Sharma', '6 min', true], ['A-025', 'Zoya Khan', '4 min'], ['A-026', 'Joseph D.', '1 min']].map(([t, n, w, p]) => (
          <li key={t} className="flex items-center gap-3 py-2">
            <span className="font-medium">{t}</span>
            <span className="text-black/60">{n}</span>
            {p && <Badge tone="attention">Priority</Badge>}
            <span className="ml-auto text-black/45">{w}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TvProductMockup() {
  return <TvMockup large className="shadow-mock" />;
}

export function AlertsMockup() {
  const items = [
    { icon: BellRing, title: 'You are 3rd in line', text: 'About 9 minutes. Start heading back.', tone: 'bg-white' },
    { icon: BellRing, title: 'It is your turn', text: 'Please go to Counter 2.', tone: 'bg-[#E6F7EE]' },
    { icon: MessageSquare, title: 'SMS: Your token K-112 is next', text: 'Sent to +91 98xxx xx210', tone: 'bg-white', paid: true },
  ];
  return (
    <div className="space-y-3 rounded-xl2 bg-[#E7F6F4] p-5 sm:p-8" aria-hidden="true">
      {items.map((n, i) => (
        <div key={n.title} className={`flex gap-3 rounded-2xl p-4 shadow-card ${n.tone}`} style={{ marginLeft: i * 16 }}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink text-white"><n.icon className="h-4 w-4" /></span>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 font-medium">{n.title} {n.paid && <Badge tone="neutral" icon={Lock}>Paid plans</Badge>}</p>
            <p className="text-sm text-black/60">{n.text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function AnalyticsMockup() {
  const bars = [22, 38, 64, 80, 70, 48, 36, 52, 74, 60, 34, 20];
  return (
    <div className={frame} aria-hidden="true">
      <div className="-mx-2 flex flex-wrap">
        <MetricTile label="Customers" value="1,284" change={14} spark={[30, 34, 31, 40, 42, 39, 47]} />
        <MetricTile label="Average wait" value="8 min" change={-21} goodWhenDown spark={[14, 13, 12, 12, 10, 9, 8]} />
      </div>
      <p className="mt-4 text-sm text-black/50">Customers per hour</p>
      <div className="mt-2 flex h-36 items-end gap-1.5">
        {bars.map((h, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <div className={`w-full rounded-t ${i === 3 ? 'bg-teal' : 'bg-teal/30'}`} style={{ height: `${h}%` }} />
            <span className="text-[10px] text-black/40">{i + 8}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
