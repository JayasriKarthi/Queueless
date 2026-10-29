import { CalendarDays } from 'lucide-react';
import MetricTile from './MetricTile';
import { LineChartBox } from './Charts';
import { todayTiles, dailyChart } from '../../lib/analytics';

const RANGES = [
  { id: '7', label: 'Last 7 days' },
  { id: '14', label: 'Last 14 days' },
  { id: '30', label: 'Last 30 days' },
];

// `report` is the server's analytics report for `range` days; it reloads live (see Home).
export default function TodayCard({ report, range, onRange }) {
  const m = todayTiles(report);
  const series = dailyChart(report);
  return (
    <section className="ql-card" aria-labelledby="today-title">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
        <h2 id="today-title" className="text-sm font-medium">Today</h2>
        <label className="relative inline-flex items-center">
          <span className="sr-only">Chart date range</span>
          <CalendarDays className="pointer-events-none absolute left-2.5 h-4 w-4 text-admin-muted" aria-hidden="true" />
          <select value={range} onChange={(e) => onRange(e.target.value)} className="ql-input h-8 w-auto pl-8 pr-7 text-[13px]">
            {RANGES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </label>
      </div>
      <div className="flex gap-1 relative overflow-x-auto px-2 pt-2 no-scrollbar" aria-live="polite">
        <MetricTile label="Tokens issued" value={m.tokens.value} change={m.tokens.change} spark={m.tokens.spark} hint="Tokens created today, compared with the same time yesterday" />
        <MetricTile label="Served" value={m.served.value} change={m.served.change} spark={m.served.spark} hint="Tokens marked done today" />
        <MetricTile label="Average wait" value={`${m.wait.value} min`} change={m.wait.change} spark={m.wait.spark} goodWhenDown hint="From joining to being called" />
        <MetricTile label="No-shows" value={m.noShows.value} change={m.noShows.change} spark={m.noShows.spark} goodWhenDown hint="Called but did not arrive" />
      </div>
      <div className="px-4 pb-4 pt-2">
        <p className="ql-subdued mb-1">Daily tokens</p>
        <LineChartBox data={series} lines={[{ key: 'volume', name: 'Tokens' }]} height={200} />
      </div>
    </section>
  );
}
